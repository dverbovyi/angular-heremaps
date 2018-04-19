[![Build Status](https://travis-ci.org/dverbovyi/angular-heremaps.svg?branch=master)](https://travis-ci.org/dverbovyi/angular-heremaps) 
[![Code Climate](https://codeclimate.com/github/dverbovyi/angular-heremaps/badges/gpa.svg)](https://codeclimate.com/github/dverbovyi/angular-heremaps)
[![npm version](https://badge.fury.io/js/angular-heremaps.svg)](https://badge.fury.io/js/angular-heremaps)


# angular-heremaps
*Live demo* **https://dverbovyi.github.io/angular-heremaps/**

AngularJS directive for working with Nokia Here Maps

### 0.1.7 latest release
[see release notes](https://github.com/dverbovyi/angular-heremaps/releases/tag/v0.1.7)

### Install guide:

        npm install angular-heremaps

##### include angular-heremaps file

```html
    <script src="/node_modules/angular-heremaps/dist/angular-heremaps.min.js" type="text/javascript"></script>
```
    
##### add dependency in your angular application

```javascript 
    angular.module('exampleModule', ['heremaps'])
```
        
##### add config provider:
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

#### Simple directive initialization with default options.

```html
        <div heremaps></div>
```

See details on [wiki pages](https://github.com/dverbovyi/angular-heremaps/wiki)

Please report, any issue [here](https://github.com/dverbovyi/angular-heremaps/issues)


### To Contribute

#### Fork and clone the project
        git clone https://github.com/{{username}}/angular-heremaps.git
        
and make pull request

#### Install dependencies
        cd angular-heremaps

        npm i

#### Start dev-server

        gulp serve

#### Build resources

        gulp build
      
