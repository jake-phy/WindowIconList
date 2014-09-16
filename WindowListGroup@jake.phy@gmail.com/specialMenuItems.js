/* jshint moz:true */
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Tweener = imports.ui.tweener;
const Tooltips = imports.ui.tooltips;

function PinnedRecentItem(menu, uri, pinIcon, title) {
    this._init(menu, uri, pinIcon, title);
}

PinnedRecentItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (menu, uri, pinIcon, title) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this._menu = menu;
		if (menu.app.get_id() != 'firefox.desktop' && menu.app.get_id() != 'firefox web browser.desktop'){
			this._item = this._menu._applet.recent_items_manager().lookup_item(uri);
			let icon = this._item.get_gicon();
			this._icon = new St.Icon({gicon: icon, style_class: 'popup-menu-icon', icon_size: 16});
			title = this._item.get_short_name();
		} else {
        	this._icon = new St.Icon({icon_name: "window-new", icon_size: 16, icon_type: St.IconType.FULLCOLOR});
		}

		this.uri = uri;
        let table = new St.Table({ homogeneous: false,
                                      reactive: true });
		table.width = 194;

		this.label = new St.Label();
		this.label.text = title;
		this.label.width = 168;

		let bin = new St.Bin({
			reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: false,
            track_hover: true
		});
		this.pinIcon = new St.Icon({icon_name: pinIcon, style_class: 'popup-menu-icon', icon_size: 16, icon_type: St.IconType.FULLCOLOR});
		bin.set_child(this.pinIcon);
		
		bin.connect('enter-event', Lang.bind(this, function(){ this.unPinRecent = true; }));
		bin.connect('leave-event', Lang.bind(this, function(){ this.unPinRecent = false; }));

		table.add(this._icon,
		          {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

        table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        table.add(bin,
                  {row: 0, col: 2, col_span: 1, x_align: St.Align.END});

        this.label.set_margin_left(6.0);

        this.addActor(table, { expand: true, span: 2, align: St.Align.START });
    },

    _onButtonReleaseEvent: function (actor, event) {
        this.activate(event, false);
    },

    activate: function (event, keepMenu) {
		if (this.unPinRecent){
			let stored = this._menu._applet.pinnedRecent;
			let appName = this._menu.app.get_name();
			if(stored[appName]){
				delete stored[appName].infos[this.uri];
			}
			this._menu._applet.pinnedRecent = stored;
    		this._menu.toggle();
        	return;
		}
        Gio.app_info_launch_default_for_uri(this.uri,  global.create_app_launch_context());
    	this._menu.toggle();
    },

};

function RecentMenuItem(menu, item, pinIcon) {
    this._init(menu, item, pinIcon);
}

RecentMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (menu, item, pinIcon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this._menu = menu;
		this._item = item;
		this.uri = this._item.get_uri();
        let table = new St.Table({ homogeneous: false,
                                      reactive: true });

		this.label = new St.Label({text: item.get_short_name()});
		this.label.width = 168;
		table.width = 194;

		let bin = new St.Bin({
			reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: false,
            track_hover: true
		});
		this.pinIcon = new St.Icon({icon_name: pinIcon, style_class: 'popup-menu-icon', icon_size: 16, icon_type: St.IconType.FULLCOLOR});
		bin.set_child(this.pinIcon);
		
		bin.connect('enter-event', Lang.bind(this, function(){ this.pinRecent = true; }));
		bin.connect('leave-event', Lang.bind(this, function(){ this.pinRecent = false; }));

		this.icon = this._item.get_gicon();

		if(this.icon){
			this._icon = new St.Icon({gicon: this.icon, style_class: 'popup-menu-icon', icon_size: 16});

		    table.add(this._icon,
		              {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});
		}

        table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        table.add(bin,
                  {row: 0, col: 2, col_span: 1, x_align: St.Align.END});

		

        this.label.set_margin_left(6.0);

        this.addActor(table, { expand: true, span: 2, align: St.Align.START });
    },

    _onButtonReleaseEvent: function (actor, event) {
        this.activate(event, false);
    },

    activate: function (event, keepMenu) {
		if (this.pinRecent){
			let stored = this._menu._applet.pinnedRecent;
			let appName = this._menu.app.get_name();
			if(stored[appName]){
				stored[appName].infos[this.uri] = {uri: this.uri};
			}else{
				stored[appName] = {infos: {}};
				stored[appName].infos[this.uri] = {uri: this.uri};
			}
			this._menu._applet.pinnedRecent = stored;
    		this._menu.toggle();
			return;
		}
    	this._menu.toggle();
        Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
    },

};

function PlaceMenuItem(menu, place) {
    this._init(menu, place);
}

PlaceMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    _init: function (menu, place) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this._menu = menu;
		this.place = place;
        let table = new St.Table({ homogeneous: false,
                                      reactive: true });

		this.label = new St.Label({text: place.name});
		this.label.width = 184;
		table.width = 194;


        this.icon = place.iconFactory(16);
        if (!this.icon)
            this.icon = new St.Icon({icon_name: "folder", icon_size: 16, icon_type: St.IconType.FULLCOLOR});
        if (this.icon)

	    table.add(this.icon,
	              {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

        table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        this.label.set_margin_left(6.0);

        this.addActor(table, { expand: true, span: 2, align: St.Align.START });
    },

    activate: function (event, keepMenu) {
    	this._menu.toggle();
        this.place.launch();
    },

};

function IconMenuItem(text, icon) {
    this._init(text, icon);
}

IconMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (text, icon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        let table = new St.Table({ homogeneous: false,
                                      reactive: true });

		this.label = new St.Label();
		this.label.text = text;
		this.label.width = 184;
		table.width = 194;


	    table.add(icon,
	              {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

        table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        this.label.set_margin_left(6.0);

        this.addActor(table, { expand: true, span: 2, align: St.Align.START });
    }
};

function FirefoxMenuItem(menu, info) {
    this._init(menu, info);
}

FirefoxMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (menu, info) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this._menu = menu;
		this.uri = info.uri;
		this.title = info.title;
        let table = new St.Table({ homogeneous: false,
                                      reactive: true });

		this.label = new St.Label({text: info.title});
		let tooltip = new Tooltips.Tooltip(this.actor, info.title);
		this.label.width = 168;
		table.width = 194;

		let bin = new St.Bin({
			reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: false,
            track_hover: true
		});
		this.pinIcon = new St.Icon({icon_name: "list-add", style_class: 'popup-menu-icon', icon_size: 16, icon_type:St.IconType.FULLCOLOR});
		bin.set_child(this.pinIcon);
		
		bin.connect('enter-event', Lang.bind(this, function(){ this.pinRecent = true; }));
		bin.connect('leave-event', Lang.bind(this, function(){ this.pinRecent = false; }));

        this.icon = new St.Icon({icon_name: "window-new", icon_size: 16, icon_type: St.IconType.FULLCOLOR});
        if (this.icon)
	    	table.add(this.icon,
	              	{row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

        table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        table.add(bin,
                  {row: 0, col: 2, col_span: 1, x_align: St.Align.END});

        this.label.set_margin_left(6.0);

        this.addActor(table, { expand: true, span: 2, align: St.Align.START });
    },

    activate: function (event, keepMenu) {
		if (this.pinRecent){
			let stored = this._menu._applet.pinnedRecent;
			let appName = this._menu.app.get_name();
			if(stored[appName]){
				stored[appName].infos[this.uri] = {uri: this.uri, title: this.title};
			}else{
				stored[appName] = {infos: {}};
				stored[appName].infos[this.uri] = {uri: this.uri, title: this.title};
			}
			this._menu._applet.pinnedRecent = stored;
    		this._menu.toggle();
			return;
		}
    	this._menu.toggle();
        Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
    }

};

function IconNameMenuItem(text, icon, iconType) {
    this._init(text, icon, iconType);
}

IconNameMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (text, icon, iconType) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        let table = new St.Table({ homogeneous: false,
                                      reactive: true });

		this.label = new St.Label({text: text});
		this.label.width = 184;
		table.width = 194;

		if(icon){
        	this.icon = new St.Icon({icon_name: icon, icon_size: 16, icon_type: iconType || St.IconType.FULLCOLOR});
	    	table.add(this.icon,
	              	{row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});
		}

        table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        this.label.set_margin_left(6.0);

        this.addActor(table, { expand: true, span: 2, align: St.Align.START });
    }
};

function SwitchMenuItem(text, active) {
    this._init(text, active);
}

SwitchMenuItem.prototype = {
    __proto__: PopupMenu.PopupSwitchMenuItem.prototype,

    _init: function (text, active) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this.label = new St.Label({ text: text });
        this._switch = new PopupMenu.Switch(active);

        let table = new St.Table({ homogeneous: false,
                                      reactive: true });
		table.width = 174;

		this.label = new St.Label({text: text});
		this.label.width = 120;


        table.add(this.label,
                  {row: 0, col: 0, col_span: 1, x_align: St.Align.END});

        this._statusBin = new St.Bin({ x_align: St.Align.END });
	    table.add(this._statusBin,
	              	{row: 0, col: 1, col_span: 1, x_expand: false, x_align: St.Align.END});

        this._statusLabel = new St.Label({ text: '',
                                           style_class: 'popup-inactive-menu-item'
                                         });
        this._statusBin.child = this._switch.actor;
        this.addActor(table, { expand: false, span: 2, align: St.Align.END });
    }
};

function SubMenuItem(text) {
    this._init(text);
}

SubMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (text) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});
		let arrow = new St.Icon({icon_name: "media-playback-start", style_class: 'popup-menu-icon', icon_size: 16});
		let icon = new St.Icon({icon_name: "preferences-system", style_class: 'popup-menu-icon', icon_size: 16});
		icon.style = "padding-right: 5px;";
        let table = new St.Table({ homogeneous: false,
                                      reactive: true });
		table.width = 194;

		this.label = new St.Label({text: text});
		this.label.width = 168;
		this.menu = new SubMenu(this.actor, arrow);
        //this.menu.actor.set_style_class_name('menu-context-menu');


        table.add(icon,
                  {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

	    table.add(this.label,
	              	{row: 0, col: 1, col_span: 1, x_align: St.Align.START});

	    table.add(arrow,
	              	{row: 0, col: 2, col_span: 1, x_align: St.Align.END});

        this.addActor(table, { expand: false, span: 2, align: St.Align.START });
    },

    activate: function () {
        this.menu.toggle();
    },


    destroy: function() {
        this.actor.destroy();
        //this.emit('destroy');
        this.menu.destroy();
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button() == 1 | 2) {
            this.activate();
        }
        return true;
    }
};
function SubMenu() {
    this._init.apply(this, arguments);
}

SubMenu.prototype = {
    __proto__: PopupMenu.PopupMenuBase.prototype,

    _init: function (sourceActor, sourceArrow) {
        PopupMenu.PopupMenuBase.prototype._init.call(this, sourceActor);
        this._arrow = sourceArrow;
        if (this._arrow) this._arrow.rotation_center_z_gravity = Clutter.Gravity.CENTER;

        this.actor = new St.BoxLayout({ style_class: 'popup-sub-menu'});

        this.actor.add_actor(this.box);
        this.actor._delegate = this;
        this.actor.clip_to_allocation = true;
        //this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
        this.actor.hide();
    },

    open: function(animate) {
        if (this.isOpen)
            return;

        this.isOpen = true;

        this.actor.show();


		this.actor._arrow_rotation = this._arrow.rotation_angle_z;

        if (animate) {
            let [minHeight, naturalHeight] = this.actor.get_preferred_height(-1);
            this.actor.height = 0;
            Tweener.addTween(this.actor,
                             { _arrow_rotation: -90,
							   height: naturalHeight,
                               time: 0.25,
                               onUpdateScope: this,
                               onUpdate: function() {
                                   this._arrow.rotation_angle_z = this.actor._arrow_rotation;
                               },
                               onCompleteScope: this,
                               onComplete: function() {
                                   this.actor.set_height(-1);
                                   this.emit('open-state-changed', true);
                               }
                             });
        } else {
            this.emit('open-state-changed', true);
        }
    },

    close: function(animate) {
        if (!this.isOpen)
            return;

        this.isOpen = false;

		this.actor._arrow_rotation = this._arrow.rotation_angle_z;

        if (animate) {
            Tweener.addTween(this.actor,
                             { _arrow_rotation: 0,
							   height: 0,
                               time: 0.25,
                               onCompleteScope: this,
                               onComplete: function() {
                                   this.actor.hide();
                                   this.actor.set_height(-1);
                                   this.emit('open-state-changed', false);
                               },
                               onUpdateScope: this,
                               onUpdate: function() {
                                   this._arrow.rotation_angle_z = this.actor._arrow_rotation;
                               }
                             });
            } else {
                this.actor.hide();

                this.isOpen = false;
                this.emit('open-state-changed', false);
            }
    },

};
