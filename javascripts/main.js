angular.module('demoModule', ['heremaps'])
    .config(["HereMapsConfigProvider", function (HereMapsConfigProvider) {
        HereMapsConfigProvider.setOptions({
            'app_id': 'your_app_id_here',
            'app_code': 'your_app_code_here',
            'useHTTPS': true
        });
    }]);