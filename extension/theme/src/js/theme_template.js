(function () {
  const tokenReplacements = {
    /* Red */
    'fe4450': "color: #fff5f6; text-shadow: 0 0 2px #000, 0 0 10px #fc1f2c[NEON_BRIGHTNESS], 0 0 5px #fc1f2c[NEON_BRIGHTNESS], 0 0 25px #fc1f2c[NEON_BRIGHTNESS]; backface-visibility: hidden;",
    /* Neon pink */
    'ff7edb': "color: #f92aad; text-shadow: 0 0 2px #100c0f, 0 0 5px #dc078e33, 0 0 10px #fff3; backface-visibility: hidden;",
    /* Yellow */
    'fede5d': "color: #f4eee4; text-shadow: 0 0 2px #393a33, 0 0 8px #f39f05[NEON_BRIGHTNESS], 0 0 2px #f39f05[NEON_BRIGHTNESS]; backface-visibility: hidden;",
    /* Green */
    '72f1b8': "color: #72f1b8; text-shadow: 0 0 2px #100c0f, 0 0 10px #257c55[NEON_BRIGHTNESS], 0 0 35px #212724[NEON_BRIGHTNESS]; backface-visibility: hidden;",
    /* Blue */
    '36f9f6': "color: #fdfdfd; text-shadow: 0 0 2px #001716, 0 0 3px #03edf9[NEON_BRIGHTNESS], 0 0 5px #03edf9[NEON_BRIGHTNESS], 0 0 8px #03edf9[NEON_BRIGHTNESS]; backface-visibility: hidden;"
  };

  const themeStylesExist = (tokensEl, replacements) => {
    return tokensEl.innerText !== '' && 
      Object.keys(replacements).every(color => {
        return tokensEl.innerText.toLowerCase().includes(`#${color}`);
      });
  };

  const replaceTokens = (styles, replacements) => Object.keys(replacements).reduce((acc, color) => {
    const re = new RegExp(`color: #${color};`, 'gi');
    return acc.replace(re, replacements[color]);
  }, styles);

  const usingGloria = () => {
    const appliedTheme = document.querySelector('[class*="theme-json"]');
    const gloriaTheme = document.querySelector('[class*="Nihil-gloria-theme-themes"]');
    return appliedTheme && gloriaTheme;
  }

  const readyForReplacement = (tokensEl, tokenReplacements) => tokensEl 
    ? (
      usingGloria() &&         
      themeStylesExist(tokensEl, tokenReplacements)
    )
    : false;

  const initGlow = (disableGlow, obs) => {
    const tokensEl = document.querySelector('.vscode-tokens-styles');

    if (!tokensEl || !readyForReplacement(tokensEl, tokenReplacements)) {
      return;
    }

    if (!document.querySelector('#gloria-theme-styles')) {
      const initialThemeStyles = tokensEl.innerText;
      
      let updatedThemeStyles = !disableGlow 
        ? replaceTokens(initialThemeStyles, tokenReplacements) 
        : initialThemeStyles;
      
      updatedThemeStyles = `${updatedThemeStyles}[CHROME_STYLES]`;
  
      const newStyleTag = document.createElement('style');
      newStyleTag.setAttribute("id", "gloria-theme-styles");
      newStyleTag.innerText = updatedThemeStyles.replace(/(\r\n|\n|\r)/gm, '');
      document.body.appendChild(newStyleTag);
      
      console.log('Gloria: GLOW initialised!');
    }

    if (obs) {
      obs.disconnect();
      obs = null;
    }
  };

  const watchForBootstrap = function(mutationsList, observer) {
    for(let mutation of mutationsList) {
      if (mutation.type === 'attributes' || mutation.type === 'childList') {
        const tokensEl = document.querySelector('.vscode-tokens-styles');
        if (readyForReplacement(tokensEl, tokenReplacements)) {
          initGlow([DISABLE_GLOW], observer);
        } else {
          if (tokensEl) {
            observer.disconnect();
            observer.observe(tokensEl, { childList: true });
          }
        }
      }
    }
  };

  const bodyNode = document.querySelector('body');
  const observer = new MutationObserver(watchForBootstrap);
  observer.observe(bodyNode, { attributes: true, childList: true });
})();