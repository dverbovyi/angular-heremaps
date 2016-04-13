module.exports = function($rootScope, $timeout){
    return {
        throttle: _throttle,
        createScriptTag: _createScriptTag,
        runScopeDigestIfNeed: _runScopeDigestIfNeed
    }
    
    
    function _throttle(fn, period){
        var timeout = null;
        
        return function(){
            if($timeout)
                $timeout.cancel(timeout);
                
            timeout = $timeout(fn, period);
        }
    }
    
    function _runScopeDigestIfNeed(scope, cb) {
        if (scope.$root && scope.$root.$$phase !== '$apply' && scope.$root.$$phase !== '$digest') {
            scope.$digest(cb || angular.noop);
            return true;
        }
        return false;
    }
    
    function _createScriptTag(src){
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = src;
        
        return script;
    }
};