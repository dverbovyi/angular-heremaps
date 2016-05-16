[![Build Status](https://travis-ci.org/dverbovyi/angular-heremaps.svg?branch=master)](https://travis-ci.org/dverbovyi/angular-heremaps)

# angular-heremaps
Angular directive for working with Nokia HereMaps

QUICK INSTALL GUIDE:

- npm isntall angular-heremaps

- add script tag in your html file:
    
    <script src="/node_modules/angular-heremaps/dist/angular-heremaps.js"></script>
    
- add "heremaps-module" as dependency in your angular-module;

    angular
        .module('exampleModule', ['heremaps'])
        
- add config provider with your map credentials:

        .config(["HereMapsConfigProvider", function(HereMapsConfigProvider) {
            HereMapsConfigProvider.setOptions({
                'app_id': 'wMHJuLgCQzkfbhzXIwRF',
                'app_code': 'WLIc7QzoO8irv7lurUt1qA',
                'useHTTPS': true
            });
        }]);
        
USAGE:

     <div heremaps class="map"
             events
             controls="bottom-right"
             map-ready="onMapReady"
             options="mapOptions"
             places="markers"></div>