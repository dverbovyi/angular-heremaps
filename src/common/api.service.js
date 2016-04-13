module.exports = function($q, UtilsService){
    var API_VERSION = {
        V: "3",
        SUB: "3.0"
    };
    
    var CONFIG = {
        BASE: "http://js.api.here.com/v",
        CORE: "mapsjs-core.js",
        SERVICE: "mapsjs-service.js",
        UI: "mapsjs-ui.js" 
    };
    
    var head = document.getElementsByTagName('head')[0];
    
    return {
        LoadApiCore: loadApiCore,
        LoadApiUI: loadApiUI
    }
    
    //#region PUBLIC 
    function loadApiCore(){
        return _getLoader(CONFIG.CORE)
                .then(function(){
                    return  _getLoader(CONFIG.SERVICE);
                });
    }
    
    function loadApiUI(){
        return _getLoader(CONFIG.UI);
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
            coreScript = UtilsService.createScriptTag(src);
            
        head.appendChild(coreScript);
        
        return $q(function(resolve, reject){
            coreScript.onload = resolve;
            coreScript.onerror = reject;
        });
    }
    
}