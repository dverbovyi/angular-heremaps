module.exports = function($q, Config, UtilsService, CONSTS) {
    var version = Config.apiVersion;

    var API_VERSION = {
        V: parseInt(version),
        SUB: version
    };

    var CONFIG = {
        BASE: "http://js.api.here.com/v",
        CORE: "mapsjs-core.js",
        SERVICE: "mapsjs-service.js",
        UI: {
            src: "mapsjs-ui.js",
            href: "mapsjs-ui.css"
        },
        EVENTS: "mapsjs-mapevents.js"
    };
    
    var API_DEFERSQueue = {};
    
    API_DEFERSQueue[CONFIG.CORE] = [];    
    API_DEFERSQueue[CONFIG.SERVICE] = [];
    API_DEFERSQueue[CONFIG.UI.src] = [];
    API_DEFERSQueue[CONFIG.PANO] = [];
    API_DEFERSQueue[CONFIG.EVENTS] = [];
    
    var head = document.getElementsByTagName('head')[0];

    return {
        loadApi: loadApi,
        loadModules: loadModules, 
        getPosition: getPosition,
        calculateRoute: calculateRoute
    };

    //#region PUBLIC
    function loadApi() {
        return _getLoader(CONFIG.CORE)
            .then(function() {
                return _getLoader(CONFIG.SERVICE);
            });
    }
    
    function loadModules(attrs, handlers){
        for(var key in handlers) {
            if(!handlers.hasOwnProperty(key) || !attrs[key])
                continue;
                
            var loader = _getLoaderByAttr(key);
            loader()
                .then(handlers[key])
        }
    }

    function getPosition(options) {
        var coordsExist = options.coords && (typeof options.coords.latitude === 'number' && typeof options.coords.longitude === 'number'); 

        var dererred = $q.defer();

        if(coordsExist) {
            dererred.resolve({coords: options.coords});
        } else {
            navigator.geolocation.getCurrentPosition(function(response) {
                dererred.resolve(response);
            }, function(error) {
                dererred.reject(error);
            }, options);
        } 
        
        return dererred.promise;
    }
    
    function calculateRoute(drivingType, From, To){
        console.log(drivingType, From, To)
    }
    //#endregion PUBLIC


    //#region PRIVATE
    function _getLoaderByAttr(attr){
        var loader;
        
        switch(attr) {
            case CONSTS.MODULES.UI:
                loader = _loadUIModule;
                break;
            case CONSTS.MODULES.EVENTS:
                loader = _loadEventsModule;
                break;
            default:
                throw new Error('Unknown module', attr);
        }
        
        return loader;
    }
    
    function _loadUIModule() {
        if (!_isLoaded(CONFIG.UI)) {
            var link = UtilsService.createLinkTag({
                rel: 'stylesheet',
                type: 'text/css',
                href: _getURL(CONFIG.UI.href)
            });

            link && head.appendChild(link);
        }

        return _getLoader(CONFIG.UI.src);
    }
    
    function _loadEventsModule() {
        return _getLoader(CONFIG.EVENTS);
    }
    
    function _getURL(sourceName) {
        return [
            CONFIG.BASE,
            API_VERSION.V,
            "/",
            API_VERSION.SUB,
            "/",
            sourceName
        ].join("");
    }

    function _getLoader(sourceName) {
        var defer = $q.defer();
        return _isLoaded(sourceName) ? (function() {
            defer.resolve();
            return defer.promise;
        })() : (function() {
            var src = _getURL(sourceName),
                script = UtilsService.createScriptTag({ src: src });
                
            script && head.appendChild(script);
            
            API_DEFERSQueue[sourceName].push(defer);
            
            script.onload = _onLoad.bind(null, sourceName);
            script.onerror = _onError.bind(null, sourceName);

            return defer.promise;

        })();
    }

    function _isLoaded(sourceName) {
        var checker = null;

        switch (sourceName) {
            case CONFIG.CORE:
                checker = _isCoreLoaded;
                break;
            case CONFIG.SERVICE:
                checker = _isServiceLoaded;
                break;
            case CONFIG.UI:
                checker = _isUILoaded;
                break;
            case CONFIG.EVENTS:
                checker = _isEventsLoaded;
                break;
            default:
                checker = function() { return false };
        }

        return checker();
    }

    function _isCoreLoaded() {
        return !!window.H;
    }

    function _isServiceLoaded() {
        return !!(window.H && window.H.service);
    }

    function _isUILoaded() {
        return !!(window.H && window.H.ui);
    }

    function _isEventsLoaded() {
        return !!(window.H && window.H.mapevents);
    }
    
    function _onLoad(sourceName){
        var deferQueue = API_DEFERSQueue[sourceName];
        for(var i = 0, l = deferQueue.length; i < l; ++i) {
            var defer = deferQueue[i];
            defer.resolve();
        }
        
        API_DEFERSQueue[sourceName] = [];
    }
    
    function _onError(sourceName) {
        var deferQueue = API_DEFERSQueue[sourceName];
        for(var i = 0, l = deferQueue.length; i < l; ++i) {
            var defer = deferQueue[i];
            defer.reject();
        }
        
        API_DEFERSQueue[sourceName] = [];
    }
};