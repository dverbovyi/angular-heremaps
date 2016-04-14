module.exports = function() {
    var MARKERS_TYPE = {

    }

    return {
        createMarker: createMarker,
        addMarkerToMap: addMarkerToMap
    }

    function createMarker(type) {
        return
    }

    function addMarkerToMap(heremaps, places) {
        console.log(heremaps);
        var map = heremaps.map;

        if (!places)
            return false;

        if (!(map instanceof H.Map))
            throw new Error('Unsupported map instance');

        places.forEach(function(place) {
            var marker = new H.map.Marker({
                lat: place.pos.lat,
                lng: place.pos.lng
            });
            
           //draggableMarkerMixin(heremaps, marker)
            
            map.addObject(marker);
        });

    }

    //TODO: should has been improved
    function draggableMarkerMixin(heremaps, marker) {
        console.log(heremaps)
        var map = heremaps.map,
            behavior = heremaps.behavior;
        
        // Ensure that the marker can receive drag events
        marker.draggable = true;

        // disable the default draggability of the underlying map
        // when starting to drag a marker object:
        map.addEventListener('dragstart', function(ev) {
            var target = ev.target;
            if (target instanceof H.map.Marker) {
                behavior.disable();
            }
        }, false);


        // re-enable the default draggability of the underlying map
        // when dragging has completed
        map.addEventListener('dragend', function(ev) {
            var target = ev.target;
            if (target instanceof mapsjs.map.Marker) {
                behavior.enable();
            }
        }, false);

        // Listen to the drag event and move the position of the marker
        // as necessary
        map.addEventListener('drag', function(ev) {
            var target = ev.target,
                pointer = ev.currentPointer;
            if (target instanceof mapsjs.map.Marker) {
                target.setPosition(map.screenToGeo(pointer.viewportX, pointer.viewportY));
            }
        }, false);
        
        return marker;
    }

};