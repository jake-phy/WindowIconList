/* jshint moz:true */
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const Clutter = imports.gi.Clutter;
const Tweener = imports.ui.tweener;
const Tooltips = imports.ui.tooltips;
const Params = imports.misc.params;

function _(str) {
   let resultConf = Gettext.dgettext('WindowListGroup@jake.phy@gmail.com', str);
   if(resultConf != str) {
      return resultConf;
   }
   return Gettext.gettext(str);
}

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
        this.table = new St.Table({ homogeneous: false,
                                      reactive: true });
        this.table.width = this._menu.AppMenuWidth;

        this.label = new St.Label();
        this.label.text = title;
        this.label.width = this._menu.AppMenuWidth - 26;

        let bin = new St.Bin({
            reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: false,
            track_hover: true
        });
        this.pinIcon =  new St.BoxLayout({
            style_class: 'unpin-item',
            reactive: true
        });
        bin.set_child(this.pinIcon);
        
        bin.connect('enter-event', Lang.bind(this, function(){ this.unPinRecent = true; }));
        bin.connect('leave-event', Lang.bind(this, function(){ this.unPinRecent = false; }));

        this.table.add(this._icon,
                  {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

        this.table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        this.table.add(bin,
                  {row: 0, col: 2, col_span: 1, x_align: St.Align.END});

        this.label.set_margin_left(6.0);

        this.addActor(this.table, { expand: true, span: 2, align: St.Align.START });
    },

    activate: function (event, keepMenu) {
        if (this.unPinRecent){
            let stored = this._menu._applet.pinnedRecent;
            let appName = this._menu.app.get_name();
            if(stored[appName]){
                delete stored[appName].infos[this.uri];
            }
            this._menu._applet.pinnedRecent = stored;
            //this._menu.toggle();
            return;
        }
        Gio.app_info_launch_default_for_uri(this.uri,  global.create_app_launch_context());
        this._menu.toggle();
    }

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
        this.table = new St.Table({ homogeneous: false,
                                      reactive: true });

        this.label = new St.Label({text: item.get_short_name()});
        this.label.width = this._menu.AppMenuWidth - 26;
        this.table.width = this._menu.AppMenuWidth;

        let bin = new St.Bin({
            reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: false,
            track_hover: true
        });
        this.pinIcon =  new St.BoxLayout({
            style_class: 'pin-item',
            reactive: true
        });
        bin.set_child(this.pinIcon);
        
        bin.connect('enter-event', Lang.bind(this, function(){ this.pinRecent = true; }));
        bin.connect('leave-event', Lang.bind(this, function(){ this.pinRecent = false; }));

        this.icon = this._item.get_gicon();

        if(this.icon){
            this._icon = new St.Icon({gicon: this.icon, style_class: 'popup-menu-icon', icon_size: 16});

            this.table.add(this._icon,
                      {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});
        }

        this.table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        this.table.add(bin,
                  {row: 0, col: 2, col_span: 1, x_align: St.Align.END});

        

        this.label.set_margin_left(6.0);

        this.addActor(this.table, { expand: true, span: 2, align: St.Align.START });
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
            //this._menu.toggle();
            return;
        }
        this._menu.toggle();
        Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
    }

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
        this.table = new St.Table({ homogeneous: false,
                                      reactive: true });

        this.label = new St.Label({text: place.name});
        this.label.width = this._menu.AppMenuWidth - 26;
        this.table.width = this._menu.AppMenuWidth;


        this.icon = place.iconFactory(16);
        if (!this.icon)
            this.icon = new St.Icon({icon_name: "folder", icon_size: 16, icon_type: St.IconType.FULLCOLOR});
        if (this.icon)

        this.table.add(this.icon,
                  {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

        this.table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        this.label.set_margin_left(6.0);

        this.addActor(this.table, { expand: true, span: 2, align: St.Align.START });
    },

    activate: function (event, keepMenu) {
        this._menu.toggle();
        this.place.launch();
    }

};

function IconMenuItem(menu, text, icon) {
    this._init(menu, text, icon);
}

IconMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (menu, text, icon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this.table = new St.Table({ homogeneous: false,
                                      reactive: true });

        this.label = new St.Label();
        this.label.text = text;
        this.label.width = menu.AppMenuWidth - 26;
        this.table.width = menu.AppMenuWidth;


        this.table.add(icon,
                  {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

        this.table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        this.label.set_margin_left(6.0);

        this.addActor(this.table, { expand: true, span: 2, align: St.Align.START });
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
        this.table = new St.Table({ homogeneous: false,
                                      reactive: true });

        this.label = new St.Label({text: info.title});
        let tooltip = new Tooltips.Tooltip(this.actor, info.title);
        this.label.width = this._menu.AppMenuWidth - 26;
        this.table.width = this._menu.AppMenuWidth;

        let bin = new St.Bin({
            reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: false,
            track_hover: true
        });
        this.pinIcon =  new St.BoxLayout({
            style_class: 'pin-item',
            reactive: true
        });
        bin.set_child(this.pinIcon);
        
        bin.connect('enter-event', Lang.bind(this, function(){ this.pinRecent = true; }));
        bin.connect('leave-event', Lang.bind(this, function(){ this.pinRecent = false; }));

        this.icon = new St.Icon({icon_name: "window-new", icon_size: 16, icon_type: St.IconType.FULLCOLOR});
        if (this.icon)
            this.table.add(this.icon,
                    {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

        this.table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        this.table.add(bin,
                  {row: 0, col: 2, col_span: 1, x_align: St.Align.END});

        this.label.set_margin_left(6.0);

        this.addActor(this.table, { expand: true, span: 2, align: St.Align.START });
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
            //this._menu.toggle();
            return;
        }
        this._menu.toggle();
        Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
    }

};

function IconNameMenuItem(menu, text, icon, iconType) {
    this._init(menu, text, icon, iconType);
}

IconNameMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (menu, text, icon, iconType) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this.table = new St.Table({ homogeneous: false,
                                      reactive: true });

        this.label = new St.Label({text: text});
        this.label.width = menu.AppMenuWidth - 26;
        this.table.width = menu.AppMenuWidth;

        if(icon){
            this.icon = new St.Icon({icon_name: icon, icon_size: 16, icon_type: iconType || St.IconType.FULLCOLOR});
            this.table.add(this.icon,
                    {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});
        	this.label.set_margin_left(6.0);
        }

        this.table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        this.addActor(this.table, { expand: true, span: 2, align: St.Align.START });
    }
};

function SwitchMenuItem(menu, text, active) {
    this._init(menu, text, active);
}

SwitchMenuItem.prototype = {
    __proto__: PopupMenu.PopupSwitchMenuItem.prototype,

    _init: function (menu, text, active) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this.label = new St.Label({ text: text });
        this._switch = new PopupMenu.Switch(active);

        this.table = new St.Table({ homogeneous: false,
                                      reactive: true });
        this.table.width = menu.AppMenuWidth - 14;

        this.label = new St.Label({text: text});
        this.label.width = menu.AppMenuWidth - 74;


        this.table.add(this.label,
                  {row: 0, col: 0, col_span: 1, x_align: St.Align.END});

        this._statusBin = new St.Bin({ x_align: St.Align.END });
        this.table.add(this._statusBin,
                    {row: 0, col: 1, col_span: 1, x_expand: false, x_align: St.Align.END});

        this._statusLabel = new St.Label({ text: '',
                                           style_class: 'popup-inactive-menu-item'
                                         });
        this._statusBin.child = this._switch.actor;
        this.addActor(this.table, { expand: false, span: 2, align: St.Align.END });
    }
};

function SubMenuItem(menu, text) {
    this._init(menu, text);
}

SubMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (menu, text) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this,{});
        let arrow = new St.Icon({icon_name: "media-playback-start", style_class: 'popup-menu-icon', icon_size: 16});
        let icon = new St.Icon({icon_name: "preferences-system", style_class: 'popup-menu-icon', icon_size: 16});
        icon.style = "padding-right: 5px;";
        this.table = new St.Table({ homogeneous: false,
                                      reactive: true });
        this.table.width = menu.AppMenuWidth;

        this.label = new St.Label({text: text});
        this.label.width = menu.AppMenuWidth - 26;
        this.menu = new SubMenu(this.actor, arrow);
        //this.menu.actor.set_style_class_name('menu-context-menu');


        this.table.add(icon,
                  {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

        this.table.add(this.label,
                    {row: 0, col: 1, col_span: 1, x_expand: true, x_align: St.Align.START});

        this.table.add(arrow,
                    {row: 0, col: 2, col_span: 1, x_expand: false, x_align: St.Align.END});

        this.addActor(this.table, { expand: false, span: 2, align: St.Align.START });
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
    __proto__: PopupMenu.PopupSubMenu.prototype,

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
    }

};
function SubSection() {
    this._init.apply(this, arguments);
}

SubSection.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    _init: function () {
        this.actor = new Cinnamon.GenericContainer({reactive: false,
                                          track_hover: false,
                                          can_focus: false });
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));
        this.actor._delegate = this;

        this._children = [];
        this._dot = null;
        this._columnWidths = null;
        this._spacing = 0;
        this.active = false;
        this._activatable = false;
        this.sensitive = true;
        this.focusOnHover = true;
        this.actor.connect('notify::hover', Lang.bind(this, this._onHoverChanged));
	},

    _onHoverChanged: function (actor) {
        this.setActive(actor.hover);
    },

    setActive: function (active) {
        this.active = active;
        if (active) {
            this.actor.add_style_pseudo_class('active');
            if (this.focusOnHover) this.actor.grab_key_focus();
        } else
            this.actor.remove_style_pseudo_class('active');
    },

    addActor: function(child, params) {
        params = Params.parse(params, { span: -1,
                                        expand: false,
                                        align: St.Align.START });
        params.actor = child;
        this._children.push(params);
        this.actor.connect('destroy', Lang.bind(this, function () { this._removeChild(child); }));
        this.actor.add_actor(child);
    },

    _removeChild: function(child) {
        for (let i = 0; i < this._children.length; i++) {
            if (this._children[i].actor == child) {
                this._children.splice(i, 1);
                return;
            }
        }
    },

    removeActor: function(child) {
        this.actor.remove_actor(child);
        this._removeChild(child);
    },

    getColumnWidths: function() {
        return 0;
    },

    _getPreferredWidth: function(actor, forHeight, alloc) {
		let width = 0, minHeiht, childHeight;
		for (let i = 0; i < this._children.length; i++) {
		    let child = this._children[i];
		    let [minHeiht, childHeight] = child.actor.get_preferred_height(-1);

			let [min, natural] = child.actor.get_preferred_width(childHeight);
            if (natural > width)
                width = natural;
		}
        alloc.min_size = alloc.natural_size = width;
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        let height = 0, minWidth, childWidth;
        for (let i = 0; i < this._children.length; i++) {
            let child = this._children[i];
            [minWidth, childWidth] = child.actor.get_preferred_width(-1);;

            let [min, natural] = child.actor.get_preferred_height(childWidth);
            if (natural > height)
                height = natural;
        }
        alloc.min_size = alloc.natural_size = height;
    },

    _allocate: function(actor, box, flags) {
        let height = box.y2 - box.y1;
        let direction = this.actor.get_direction();

        let x;
        if (direction == St.TextDirection.LTR)
            x = box.x1;
        else
            x = box.x2;
        // if direction is ltr, x is the right edge of the last added
        // actor, and it's constantly increasing, whereas if rtl, x is
        // the left edge and it decreases
        for (let i = 0, col = 0; i < this._children.length; i++) {
            let child = this._children[i];
            let childBox = new Clutter.ActorBox();

            let [minWidth, naturalWidth] = child.actor.get_preferred_width(-1);
			let availWidth;
            if (direction == St.TextDirection.LTR)
                availWidth = box.x2 - x;
            else
                availWidth = x - box.x1;

            if (direction == St.TextDirection.LTR) {
                    childBox.x1 = x;
                    childBox.x2 = x + availWidth;
            } else {
                    // align to the right
                    childBox.x2 = x;
                    childBox.x1 = x - availWidth;
            }

            let [minHeight, naturalHeight] = child.actor.get_preferred_height(childBox.x2 - childBox.x1);
            childBox.y1 = Math.round(box.y1 + (height - naturalHeight) / 2);
            childBox.y2 = childBox.y1 + naturalHeight;

            child.actor.allocate(childBox, flags);
        }
    }
};
