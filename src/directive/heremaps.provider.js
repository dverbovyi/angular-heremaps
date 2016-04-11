module.exports = function () {
    var options = {}, apiLoaded = false;

    return HereMapProvider;

    function HereMapProvider() {
        this.$get = function () {
            return {
                app_id: options.app_id || '',
                app_code: options.app_code || ''
            }
        };

        this.setOptions = function (opts) {
            options = opts;
            if(!apiLoaded)
                _loadAPI();
        };
    }

    function _loadAPI(){
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'http://js.api.here.com/v3/3.0/mapsjs-core.js';
        document.getElementsByTagName('head')[0].appendChild(script);

        script.onload = function () {
            apiLoaded = true;
            alert('loaded');
        };
    //<script src="http://js.api.here.com/v3/3.0/mapsjs-core.js"
    //  type="text/javascript" charset="utf-8"></script>
    //<script src="http://js.api.here.com/v3/3.0/mapsjs-service.js"
    //  type="text/javascript" charset="utf-8"></script>
    }
};