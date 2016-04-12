module.exports = function($rootScope, $q) {
    var options = {}, apiLoaded = false;

    return {
        setConfig: _setConfig,
        getConfig: _getConfig
    }

    function _setConfig(opts) {
        options = opts;
        if (!apiLoaded)
            _loadAPI();
    }

    function _getConfig() {
        return options;
    }

    function _loadAPI() {
        var head = document.getElementsByTagName('head')[0],
            coreScript = document.createElement('script'),
            serviceScript = document.createElement('script');

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