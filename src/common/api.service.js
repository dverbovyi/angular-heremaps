'use strict';

module.exports = function($q, UtilsService){
    var API_VERSION = {
        V: "3",
        SUB: "3.0"
    };
    
    var CONFIG = {
        BASE: "http://js.api.here.com/v",
        CORE: "mapsjs-core.js",
        SERVICE: "mapsjs-service.js",
        UI: {
            src: "mapsjs-ui.js",
            href: "mapsjs-ui.css"
        }
    };
    
    var head = document.getElementsByTagName('head')[0];
    
    return {
        loadApiCore: loadApiCore,
        loadUIComponent: loadUIComponent
    };
    
    //#region PUBLIC 
    function loadApiCore(){
        return _getLoader(CONFIG.CORE)
                .then(function(){
                    return _getLoader(CONFIG.SERVICE);
                });
    }
    
    function loadUIComponent(){
        return _getLoader(CONFIG.UI.src).then(function(){
            var href = _getURL(CONFIG.UI.href),
                link = UtilsService.createLinkTag({
                    rel: 'stylesheet',
                    type: 'text/css',
                    href: href,
                    id: CONFIG.UI.href
                });

            if(link)
                head.appendChild(link);
        });
    }
    //#endregion PUBLIC


    //#region PRIVATE
    function _getURL(sourceName){
        return [
                CONFIG.BASE,
                API_VERSION.V,
                "/",
                API_VERSION.SUB,
                "/",
                sourceName
            ].join("");
    }
    
    function _getLoader(sourceName){
        var src = _getURL(sourceName),
            coreScript = UtilsService.createScriptTag({
                src: src,
                id: sourceName
            });

        return $q(function(resolve, reject){
            if(!coreScript) {
                resolve();
                return true;
            }
            head.appendChild(coreScript);

            coreScript.onload = resolve;
            coreScript.onerror = reject;
        });
    }
};