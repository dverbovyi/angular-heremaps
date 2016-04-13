module.exports = function($rootScope, $q) {
    var options = {}, apiLoaded = false;
    
    var EVENTS = {
        CORE_READY: "HEREMAPS_CORE_READY",
        UI_READY: "HEREMAPS_UI_READY"
    }

    return {
        EVENTS: EVENTS,
        setConfig: _setConfig,
        getConfig: _getConfig,
        loadCore: _loadCore,
        loadUI: _loadUI
        subscribe: _subscribe
    }

    function _setConfig(opts) {
        options = opts;
        if(!apiLoaded)
            _loadAPICore();
    }

    function _getConfig() {
        return options;
    }
    
    function _subscribe(scope, eventName, listener){
        var subscriber = $rootScope.$on(eventName, listener);
        scope.$on('$destroy', subscriber);
    }

    function _loadAPICore() {
        var head = document.getElementsByTagName('head')[0],
            coreScript = document.createElement('script'),
            serviceScript = document.createElement('script');
            // uiScript = document.createElement('script');
            
    //         <script src="http://js.api.here.com/v3/3.0/mapsjs-ui.js" 
    //   type="text/javascript" charset="utf-8"></script>

        coreScript.type = serviceScript.type = 'text/javascript';
        coreScript.src = 'http://js.api.here.com/v3/3.0/mapsjs-core.js';
        serviceScript.src = 'http://js.api.here.com/v3/3.0/mapsjs-service.js';

        var loadCore = function() {
            head.appendChild(coreScript);
            
            return $q(function(resolve, reject) {
                coreScript.onload = resolve;
                coreScript.onerror = reject;
            });
        }

        var loadService = function() {
            head.appendChild(serviceScript);
            
            return $q(function(resolve, reject) {
                serviceScript.onload = resolve;
                serviceScript.onerror = reject;
            });
        }
        
        loadCore().then(function(){
            return loadService();
        }).then(function(){
            apiLoaded = true;
            $rootScope.$emit('HEREMAPS_API_READY');    
        }).catch(function(e){
            console.warn('Here Maps API load failure', e)    
        });
        
    }
};