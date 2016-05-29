module.exports = function(MarkersService, HereMapUtilsService, CONSTS) {
    function InfoBubble() {}

    var proto = InfoBubble.prototype;
        
    proto.create = create;
    proto.update = update;
    proto.toggle = toggle;
    proto.show = show;
    proto.close = close;

    return {
        create: function(){
            return new InfoBubble();
        }
    }

    function toggle(e, ui) {
        if (MarkersService.isMarkerInstance(e.target))
            this.show(e, ui);
        else
            this.close(e, ui);
    }

    function update(bubble, data) {
        bubble.display = data.display;

        bubble.setPosition(data.position);
        bubble.setContent(data.markup);

        bubble.setState(CONSTS.INFOBUBBLE.STATE.OPEN);
    }

    function create(data) {
        var bubble = new H.ui.InfoBubble(data.position, {
            content: data.markup
        });

        bubble.display = data.display;
        bubble.addClass(CONSTS.INFOBUBBLE.STATE.OPEN)

        HereMapUtilsService.addEventListener(bubble, 'statechange', function(e) {
            var state = this.getState(),
                el = this.getElement();
            if (state === CONSTS.INFOBUBBLE.STATE.CLOSED) {
                el.classList.remove(CONSTS.INFOBUBBLE.STATE.OPEN);
            } else
                this.addClass(state)
        });

        return bubble;
    }

    function show(e, ui) {
        var target = e.target,
            data = target.getData(),
            el = null;

        if (!data.display || !data.markup || data.display !== CONSTS.INFOBUBBLE.DISPLAY_EVENT[e.type])
            return;

        var source = {
            position: target.getPosition(),
            markup: data.markup,
            display: data.display
        };

        if (!ui.bubble) {
            ui.bubble = this.create(source);
            ui.addBubble(ui.bubble);

            return;
        }

        this.update(ui.bubble, source);
    }

    function close(e, ui) {
        if (!ui.bubble || ui.bubble.display !== CONSTS.INFOBUBBLE.DISPLAY_EVENT[e.type]) {
            return;
        }

        ui.bubble.setState(CONSTS.INFOBUBBLE.STATE.CLOSED);
    }
}