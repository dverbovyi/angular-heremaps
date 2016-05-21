[![Build Status](https://travis-ci.org/dverbovyi/angular-heremaps.svg?branch=master)](https://travis-ci.org/dverbovyi/angular-heremaps)

# angular-heremaps
Angular directive for working with Nokia Here Maps

### Install guide:

        npm install angular-heremaps --save

#####include angular-heremaps file

```html
    <script src="/node_modules/angular-heremaps/dist/angular-heremaps.js" type="text/javascript"></script>
```
    
#####add dependency in your angular application

```javascript 
    angular.module('exampleModule', ['heremaps'])
```
        
#####add config provider:
Before, you should register [here](https://developer.here.com/plans/api/consumer-mapping) and get your app id. Then pass it below

```javascript
    angular.module('exampleModule')
        .config(["HereMapsConfigProvider", function(HereMapsConfigProvider) {
            HereMapsConfigProvider.setOptions({
                'app_id': 'your_app_id_here',
                'app_code': 'your_app_code_here',
                'useHTTPS': true
            });
        }]);
```

####Simple directive initialization with default options. Please, see extended details on [wiki](https://github.com/dverbovyi/angular-heremaps/wiki)

```html
        <div heremaps></div>
```

### Detailed documentation

See [Wiki Page](https://github.com/dverbovyi/angular-heremaps/wiki)
