import React, { useEffect, useReducer, useCallback } from 'react';
import getUniqueCharsInPage from './get-unique-chars-in-page';
import reducer from './reducer';
import useMutationObserver from './use-mutation-observer';
import type { FontWeights, Display } from './create-font-link-tags';

const filter = {
  acceptNode: function (node: Node) {
    if (
      node.parentNode &&
      (node.parentNode.nodeName === 'SCRIPT' || node.parentNode.nodeName === 'STYLE')
    ) {
      return NodeFilter.FILTER_REJECT;
    } else {
      return NodeFilter.FILTER_ACCEPT;
    }
  },
};

type UseFontFromContentProps = {
  fontName: string;
  onLoad?: () => void;
  display?: Display;
  fontWeights?: FontWeights;
};

export default function useFontFromContent({
  fontName,
  onLoad,
  display = 'swap',
  fontWeights,
}: UseFontFromContentProps): {
  linkTags: React.ReactElement<HTMLLinkElement, string | React.JSXElementConstructor<unknown>>[];
  isFontUpdating: boolean;
} {
  const [state, dispatch] = useReducer(reducer, {
    fontName,
    linkTags: [
      <link key="preconnect-googleapis" rel="preconnect" href="https://fonts.googleapis.com" />,
      <link
        key="preconnect-gstatic"
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin=""
      />,
    ],
    requestedChars: new Set<string>(),
    onLoad,
    display,
    fontWeights,
  });

  const mutationCallback = useCallback((mutations: MutationRecord[]) => {
    dispatch({ type: 'FONT_UPDATING' });
    const mutatedNodes: Node[] = [];

    mutations.forEach((mutation) => {
      switch (mutation.type) {
        case 'childList': {
          mutation.addedNodes.forEach((addedNode) => {
            if (addedNode.nodeType === Node.TEXT_NODE || addedNode.nodeType === Node.ELEMENT_NODE) {
              mutatedNodes.push(addedNode);
            }
          });
          break;
        }
        case 'characterData': {
          /**
           * This block of code checks for 'characterData' mutations.
           * As per the DOM specification, a 'characterData' mutation occurs when the data of a text node directly changes.
           * In a typical React application, you would not expect a 'characterData' mutation.
           * This is because React's reconciliation process favors creating a new node over mutating existing nodes.
           * Even when we change the text content of an element directly using a ref in React, it will cause a 'childList' mutation and not a 'characterData' mutation.
           * However, this code block is retained for potential edge cases or non-typical React usage where 'characterData' mutations could be introduced.
           */
          if (
            mutation.target.nodeType === Node.TEXT_NODE ||
            mutation.target.nodeType === Node.ELEMENT_NODE
          ) {
            mutatedNodes.push(mutation.target);
          }
        }
      }
    });

    if (mutatedNodes.length > 0) {
      const newChars = getUniqueCharsInPage(mutatedNodes);
      if (newChars.size > 0) {
        dispatch({ type: 'ADD_LINK_TAG', newChars });
      }
    }
  }, []);

  useMutationObserver(mutationCallback);

  useEffect(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, filter);

    dispatch({
      type: 'INITIALIZE',
      uniqueChars: getUniqueCharsInPage(walker),
    });
  }, []);

  return { linkTags: state.linkTags, isFontUpdating: Boolean(state.isFontUpdating) };
}
