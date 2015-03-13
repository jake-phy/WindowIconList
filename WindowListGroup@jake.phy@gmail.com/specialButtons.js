//vim: expandtab shiftwidth=4 tabstop=8 softtabstop=4 encoding=utf-8 textwidth=99
/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
// Some app-buttons that display an icon
// and an label
/* jshint moz:true */
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;
const Meta = imports.gi.Meta;
const DND = imports.ui.dnd;
const Gettext = imports.gettext;

const BUTTON_BOX_ANIMATION_TIME = 0.5;
const MAX_BUTTON_WIDTH = 150; // Pixels

const AppletDir = imports.ui.appletManager.applets['WindowListGroup@jake.phy@gmail.com'];
const Applet = AppletDir.applet;

const TitleDisplay = {
    none: 1,
    app: 2,
    title: 3
};


function _(str) {
   let resultConf = Gettext.dgettext('WindowListGroup@jake.phy@gmail.com', str);
   if(resultConf != str) {
      return resultConf;
   }
   return Gettext.gettext(str);
}


// Creates a button with an icon and a label.
// The label text must be set with setText
// @icon: the icon to be displayed


function IconLabelButton() {
    this._init.apply(this, arguments);
}

IconLabelButton.prototype = {
    _init: function (parent) {
        if (parent.icon === null) throw 'IconLabelButton icon argument must be non-null';
        this._applet = parent._applet;
        this._icon = parent.icon;
        this.actor = new St.Bin({
            style_class: 'window-list-item-box',
            reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: false,
            track_hover: true
        });
        this.actor.add_style_class_name('app-list-item-box');
        this.actor.height = parent._applet._panelHeight;
        if (this._applet.orientation == St.Side.TOP)
            this.actor.add_style_class_name('window-list-item-box-top');
        else
            this.actor.add_style_class_name('window-list-item-box-bottom');
        this.actor._delegate = this;

        // We do a fancy layout with icons and labels, so we'd like to do our own allocation
        // in a Cinnamon.GenericContainer
        this._container = new Cinnamon.GenericContainer({
            name: 'iconLabelButton'
        });
        this.actor.set_child(this._container);
        this._container.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this._container.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this._container.connect('allocate', Lang.bind(this, this._allocate));

        //this._icon.set_child(parent.icon);
        this._label = new St.Label();
        this._numLabel = new St.Label({
            style_class: 'window-list-item-label'
        });
        this._numLabel.style = 'text-shadow: black 1px 0px 2px';

        this._container.add_actor(this._icon);
        this._container.add_actor(this._label);
        this._container.add_actor(this._numLabel);

        this.setIconPadding();

        this._applet.settings.connect("changed::icon-padding", Lang.bind(this, this.setIconPadding));
    },

    setIconPadding: function () {
        this.actor.style = "padding-bottom: 0px;padding-top:1px; padding-left: " + this._applet.iconPadding + "px;padding-right:" + this._applet.iconPadding + "px;";
    },

    setText: function (text) {
        if (text)
            this._label.text = text;
    },

    setStyle: function (name) {
        if (name)
            this.actor.set_style_class_name(name);
    },

    _getPreferredWidth: function (actor, forHeight, alloc) {
        let [iconMinSize, iconNaturalSize] = this._icon.get_preferred_width(forHeight);
        let [labelMinSize, labelNaturalSize] = this._label.get_preferred_width(forHeight);
        // The label text is starts in the center of the icon, so we should allocate the space
        // needed for the icon plus the space needed for(label - icon/2)
        alloc.min_size = iconMinSize;
        alloc.natural_size = Math.min(iconNaturalSize + Math.max(0, labelNaturalSize), MAX_BUTTON_WIDTH);
    },

    _getPreferredHeight: function (actor, forWidth, alloc) {
        let [iconMinSize, iconNaturalSize] = this._icon.get_preferred_height(forWidth);
        let [labelMinSize, labelNaturalSize] = this._label.get_preferred_height(forWidth);
        alloc.min_size = Math.min(iconMinSize, labelMinSize);
        alloc.natural_size = Math.max(iconNaturalSize, labelNaturalSize);
    },

    _allocate: function (actor, box, flags) {
        // returns [x1,x2] so that the area between x1 and x2 is
        // centered in length


        function center(length, naturalLength) {
            let maxLength = Math.min(length, naturalLength);
            let x1 = Math.max(0, Math.floor((length - maxLength) / 2));
            let x2 = Math.min(length, x1 + maxLength);
            return [x1, x2];
        }
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;
        let childBox = new Clutter.ActorBox();
        let direction = this.actor.get_text_direction();

        // Set the icon to be left-justified (or right-justified) and centered vertically
        let [iconMinWidth, iconMinHeight, iconNaturalWidth, iconNaturalHeight] = this._icon.get_preferred_size();
        [childBox.y1, childBox.y2] = center(allocHeight, iconNaturalHeight);
        if (direction == Clutter.TextDirection.LTR) {
            [childBox.x1, childBox.x2] = [0, Math.min(iconNaturalWidth, allocWidth)];
        } else {
            [childBox.x1, childBox.x2] = [Math.max(0, allocWidth - iconNaturalWidth), allocWidth];
        }
        this._icon.allocate(childBox, flags);
        //        log('allocateA ' + [childBox.x1<0, childBox.x2<0, childBox.y1, childBox.y2] + ' ' + [childBox.x2-childBox.x1, childBox.y2-childBox.y1])
        // Set the label to start its text in the left of the icon
        let iconWidth = childBox.x2 - childBox.x1;
        [minWidth, minHeight, naturalWidth, naturalHeight] = this._label.get_preferred_size();
        [childBox.y1, childBox.y2] = center(allocHeight, naturalHeight);
        if (direction == Clutter.TextDirection.LTR) {
            childBox.x1 = iconWidth;
            childBox.x2 = Math.min(allocWidth, MAX_BUTTON_WIDTH);
        } else {
            childBox.x2 = Math.min(allocWidth - iconWidth, MAX_BUTTON_WIDTH);
            childBox.x1 = Math.max(0, childBox.x2 - naturalWidth);
        }
        this._label.allocate(childBox, flags);
        //        log('allocateB ' + [childBox.x1<0, childBox.x2<0, childBox.y1, childBox.y2] + ' ' + [childBox.x2-childBox.x1, childBox.y2-childBox.y1])
        if (direction == Clutter.TextDirection.LTR) {
            childBox.x1 = -3;
            childBox.x2 = childBox.x1 + this._numLabel.width;
            childBox.y1 = box.y1 - 2;
            childBox.y2 = box.y2 - 1;
        } else {
            childBox.x1 = -this._numLabel.width;
            childBox.x2 = childBox.x1 + this._numLabel.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
        }
        this._numLabel.allocate(childBox, flags);
    },
    showLabel: function (animate, targetWidth) {
        // need to turn width back to preferred.
        let setToZero;
        if(this._label.width < 2) {
            this._label.set_width(-1);
            setToZero = true;
        } else if(this._label.width < (this._label.text.length * 7) - 5 || this._label.width > (this._label.text.length * 7) + 5) {
            this._label.set_width(-1);
        }
        let [minWidth, naturalWidth] = this._label.get_preferred_width(-1);
        let width = Math.min(targetWidth || naturalWidth, 150)
        if(setToZero)
            this._label.width = 1;
        if (!animate) {
            this._label.width = width;
            return;
        }
        this._label.show();
        Tweener.addTween(this._label, {
            width: width,
            time: BUTTON_BOX_ANIMATION_TIME,
            transition: "easeOutQuad"
        });
    },

    hideLabel: function (animate) {
        if (!animate) {
            this._label.width = 1;
            this._label.hide();
            return;
        }

        Tweener.addTween(this._label, {
            width: 1,
            // FIXME: if this is set to 0, a whole bunch of "Clutter-CRITICAL **: clutter_paint_volume_set_width: assertion `width >= 0.0f' failed" messages appear
            time: BUTTON_BOX_ANIMATION_TIME,
            transition: "easeOutQuad",
            onCompleteScope: this,
            onComplete: function () {
                this._label.hide();
            }
        });
    }
};

// Button with icon and label.  Click events
// need to be attached manually, but automatically
// highlight when a window of app has focus.


function AppButton() {
    this._init.apply(this, arguments);
}

AppButton.prototype = {
    __proto__: IconLabelButton.prototype,

    _init: function (parent) {
        this.icon_size = Math.floor(parent._applet._panelHeight - 4);
        this.app = parent.app;
        this.icon = this.app.create_icon_texture(this.icon_size);
        this._applet = parent._applet;
        this._parent = parent;
        this.isFavapp = parent.isFavapp;
        IconLabelButton.prototype._init.call(this, this);
        if (this.isFavapp) this._isFavorite(true);

        let tracker = Cinnamon.WindowTracker.get_default();
        this._trackerSignal = tracker.connect('notify::focus-app', Lang.bind(this, this._onFocusChange));
        this._attention = global.settings.connect('changed::window-list-applet-alert', Lang.bind(this, this._onAttentionRequest));
        this._onAttentionRequest();
        this._needsAttention = false;
    },

    _onFocusChange: function () {
        // If any of the windows associated with our app have focus,
        // we should set ourselves to active
        if (this.app.get_windows().some(function (w) {
            return w.appears_focused;
        })) {
            this.actor.add_style_pseudo_class('focus');
            this.actor.remove_style_class_name("window-list-item-demands-attention");
            this.actor.remove_style_class_name("window-list-item-demands-attention-top");
            this._needsAttention = false;
        } else {
            this.actor.remove_style_pseudo_class('focus');
        }
    },

    _onAttentionRequest: function () {
        if (this.isFavapp) return false;
        let active = global.settings.get_boolean('window-list-applet-alert');
        if (active) {
            this._urgent_signal = global.display.connect('window-marked-urgent', Lang.bind(this, this._onWindowDemandsAttention));
        } else {
            if (this._urgent_signal) {
                global.display.disconnect(this._urgent_signal);
            }
        }
        return true;
    },

    _onWindowDemandsAttention : function(display, window) {
        let windows = this.parent.metaWindows;
        for (let w in windows) {
            if (windows[w].win == window ) {
                if(!window.appears_focused){
                    this._needsAttention = true;
                    this.actor.add_style_class_name('window-list-item-demands-attention');
                    return true;
                }
            }
        }
        return false;
    },

    _isFavorite: function (isFav) {
        if (isFav) {
            this.setStyle("panel-launcher");
            this.actor.add_style_class_name('app-is-favorite');
            this._label.text = '';
        } else {
            this.setStyle('window-list-item-box');
            if (this._applet.orientation == St.Side.TOP)
                this.actor.add_style_class_name('window-list-item-box-top');
            else
                this.actor.add_style_class_name('window-list-item-box-bottom');
            this.actor.add_style_class_name('app-list-item-box');
        }
    },


    destroy: function () {
        let tracker = Cinnamon.WindowTracker.get_default();
        tracker.disconnect(this._trackerSignal);
        global.settings.disconnect(this._attention);
        this._container.destroy_children();
        this._container.destroy();
        this.actor.destroy();
    }
};

function _Draggable(actor, params) {
    this._init(actor, params);
}

_Draggable.prototype = {
    __proto__: DND._Draggable.prototype,

    _grabActor: function () {
        //Clutter.grab_pointer(this.actor);
        this._onEventId = this.actor.connect('event', Lang.bind(this, this._onEvent));
    }
};

function makeDraggable(actor, params) {
    return new _Draggable(actor, params);
}

function MyAppletBox(applet) {
    this._init(applet);
}

MyAppletBox.prototype = {
    _init: function (applet) {
        this.actor = new St.BoxLayout({
            style_class: 'window-list-box'
        });
        this.actor._delegate = this;

        this._applet = applet;

        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;
    },

    handleDragOver: function (source, actor, x, y, time) {
        let IsLauncherDraggable = null;
        if(DND.LauncherDraggable)
           IsLauncherDraggable =  source instanceof DND.LauncherDraggable;
        if (!(source.isDraggableApp || IsLauncherDraggable)) return DND.DragMotionResult.NO_DROP;

        let children = this.actor.get_children();
        let windowPos = children.indexOf(source.actor);

        let pos = 0;

        for (var i in children) {
            if (x > children[i].get_allocation_box().x1 + children[i].width / 2) pos = i;
        }

        if (pos != this._dragPlaceholderPos) {
            this._dragPlaceholderPos = pos;

            // Don't allow positioning before or after self
            if (windowPos != -1 && pos == windowPos) {
                if (this._dragPlaceholder) {
                    this._dragPlaceholder.animateOutAndDestroy();
                    this._animatingPlaceholdersCount++;
                    this._dragPlaceholder.actor.connect('destroy', Lang.bind(this, function () {
                        this._animatingPlaceholdersCount--;
                    }));
                }
                this._dragPlaceholder = null;

                return DND.DragMotionResult.CONTINUE;
            }

            // If the placeholder already exists, we just move
            // it, but if we are adding it, expand its size in
            // an animation
            let fadeIn;
            if (this._dragPlaceholder) {
                this._dragPlaceholder.actor.destroy();
                fadeIn = false;
            } else {
                fadeIn = true;
            }

            let childWidth;
            let childHeight;
            if (source.isDraggableApp) {
                childWidth = 30;
                childHeight = 24;
            } else {
                childWidth = source.actor.width;
                childHeight = source.actor.height;
            }
            this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this._dragPlaceholder.child.width = childWidth;
            this._dragPlaceholder.child.height = childHeight;
            this.actor.insert_actor(this._dragPlaceholder.actor, this._dragPlaceholderPos);
            if (fadeIn) this._dragPlaceholder.animateIn();
        }

        return DND.DragMotionResult.MOVE_DROP;
    },

    acceptDrop: function (source, actor, x, y, time) {
        let IsLauncherDraggable = null;
        if(DND.LauncherDraggable)
           IsLauncherDraggable =  source instanceof DND.LauncherDraggable;
        if (!(source.isDraggableApp || IsLauncherDraggable)) return false;

        if (!(source.isFavapp || source.wasFavapp || source.isDraggableApp || IsLauncherDraggable) || source.isNotFavapp) {
            this.actor.move_child(source.actor, this._dragPlaceholderPos);
            this._clearDragPlaceholder();
            actor.destroy();
            return true;
        }
        this.actor.move_child(source.actor, this._dragPlaceholderPos);
        let app = source.app;

        // Don't allow favoriting of transient apps
        if (!app || app.is_window_backed()) {
            return false;
        }

        let id;
        if (IsLauncherDraggable) id = source.getId();
        else id = app.get_id();
        let favorites = this._applet.pinned_app_contr().getFavoriteMap();
        let srcIsFavorite = (id in favorites);
        let favPos = this._dragPlaceholderPos;

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this, function () {
            let appFavorites = this._applet.pinned_app_contr();
            this._clearDragPlaceholder();
            if (srcIsFavorite) appFavorites.moveFavoriteToPos(id, favPos);
            else appFavorites.addFavoriteAtPos(id, favPos);
            return false;
        }));
        this._clearDragPlaceholder();
        actor.destroy();
        return true;
    },

    _clearDragPlaceholder: function () {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    }
};
