const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;

// THUMBNAIL OPTIONS
const THUMBNAIL_ICON_SIZE = 16;
const HOVER_MENU_TIMEOUT = 500;
const THUMBNAIL_SIZE = 7;
const GROUP_THUMBNAILS = true;
//

const AppletDir = imports.ui.appletManager.applets['WindowIconList@jake.phy@gmail.com'];

function HoverMenuController(owner) {
    this._init(owner);
}

HoverMenuController.prototype = {
    __proto__ : PopupMenu.PopupMenuManager.prototype,

    _grab: function() {
        Main.pushModal(this._owner.actor);

        this._eventCaptureId = global.stage.connect('captured-event', Lang.bind(this, this._onEventCapture));
        // captured-event doesn't see enter/leave events
        this._enterEventId = global.stage.connect('enter-event', Lang.bind(this, this._onEventCapture));
        this._leaveEventId = global.stage.connect('leave-event', Lang.bind(this, this._onEventCapture));
        this._keyFocusNotifyId = global.stage.connect('notify::key-focus', Lang.bind(this, this._onKeyFocusChanged));

        this.grabbed = true;
    },

    _onEventCapture: function(actor, event) {
        if (!this.grabbed)
            return false;

        if (this._owner.menuEventFilter &&
            this._owner.menuEventFilter(event))
            return true;

        if (this._activeMenu != null && this._activeMenu.passEvents)
            return false;

        if (this._didPop) {
            this._didPop = false;
            return true;
        }

        let activeMenuContains = this._eventIsOnActiveMenu(event);
        let eventType = event.type();

        if (eventType == Clutter.EventType.BUTTON_RELEASE) {
            if (activeMenuContains) {
                return false;
            } else {
                this._closeMenu();
                return true;
            }
        } else if (eventType == Clutter.EventType.BUTTON_PRESS && !activeMenuContains) {
            this._closeMenu();
            return true;
        } else if (!this._shouldBlockEvent(event)) {
            return false;
        }

        return false;
    }
};

function AppThumbnailHoverMenu() {
    this._init.apply(this, arguments);
}

AppThumbnailHoverMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(actor, metaWindow, orientation, params) {
       params = Params.parse (params, { reactive: false,
                                         activate: false,
                                         hover: false,
                                         sensitive: false,
                                         style_class: null,
                                         focusOnHover: false
                                       });
        PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.45, orientation);

        this.metaWindow = metaWindow;
	let tracker = Cinnamon.WindowTracker.get_default();
        this.app = tracker.get_window_app(this.metaWindow);      
  	this.actor.style_class = null;
	this.actor.set_style("-arrow-background-color: rgba(80,80,80,0.0);-arrow-border-color: rgba(150,150,150,0.0);");
        this.actor.hide();

        Main.layoutManager.addChrome(this.actor, this.orientation);

        this.appSwitcherItem = new PopupMenuAppSwitcherItem(this.metaWindow, this.app, params);
        this.addMenuItem(this.appSwitcherItem);

        actor.connect('enter-event', Lang.bind(this, this._onEnter));
        actor.connect('leave-event', Lang.bind(this, this._onLeave));
        actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));

        this.actor.connect('enter-event', Lang.bind(this, this._onMenuEnter));
        this.actor.connect('leave-event', Lang.bind(this, this._onMenuLeave));
        
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
    },

    _onButtonPress: function(actor, event) {
        this.shouldOpen = false;
        this.shouldClose = true;
        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.hoverClose));
    },

    _onMenuEnter: function() {
        this.shouldOpen = true;
        this.shouldClose = false;

        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.hoverOpen));
    },

    _onMenuLeave: function() {
        this.shouldOpen = false;
        this.shouldClose = true;
        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.hoverClose));
    },

    _onEnter: function() {
        this.shouldOpen = true;
        this.shouldClose = false;

        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.hoverOpen));
    },

    _onLeave: function() {
        this.shouldClose = true;
        this.shouldOpen = false;

        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.hoverClose));
    },

    hoverOpen: function() {
        if (this.shouldOpen && !this.isOpen) {
            this.open(true);
        }
    },

    hoverClose: function() {
        if (this.shouldClose) {
            this.close(true);
        }
    },

    open: function(animate) {
        // Refresh all the thumbnails, etc when the menu opens.  These cannot
        // be created when the menu is initalized because a lot of the clutter window surfaces
        // have not been created yet...
        this.appSwitcherItem._refresh();
        PopupMenu.PopupMenu.prototype.open.call(this, animate);
    },

    close: function(animate) {
        // Refresh all the thumbnails, etc when the menu opens.  These cannot
        // be created when the menu is initalized because a lot of the clutter window surfaces
        // have not been created yet...
        PopupMenu.PopupMenu.prototype.close.call(this, animate);
    },

    setMetaWindow: function(metaWindow) {
        this.metaWindow = metaWindow;
        this.appSwitcherItem.setMetaWindow(metaWindow);
    }
};

// display a list of app thumbnails and allow
// bringing any app to focus by clicking on its thumbnail
function PopupMenuAppSwitcherItem() {
    this._init.apply(this, arguments);
}

PopupMenuAppSwitcherItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (metaWindow, app, params) {
        params = Params.parse (params, { reactive: false,
                                         activate: false,
                                         hover: false,
                                         sensitive: false,
                                         style_class: null,
                                         focusOnHover: false
                                       });
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.metaWindow = metaWindow;
	let tracker = Cinnamon.WindowTracker.get_default();
        this.app = tracker.get_window_app(this.metaWindow);
        

        this.appContainer = new St.BoxLayout({ style_class: 'switcher-list'});
	this.appContainer.set_style("padding: 6px;border-radius: 12px;");
        this.appThumbnails = {};

        this._refresh();

        this.addActor(this.appContainer);
    },

    setMetaWindow: function(metaWindow) {
        this.metaWindow = metaWindow;
    },

    _refresh: function() {
        // Check to see if this.metaWindow has changed.  If so, we need to recreate
        // our thumbnail, etc.
        if (this.metaWindowThumbnail && this.metaWindowThumbnail.metaWindow == this.metaWindow) {
            this.metaWindowThumbnail._refresh();
        } else {
            if (this.metaWindowThumbnail) {
                this.metaWindowThumbnail.destroy();
            }
            // If our metaWindow is null, just move along
            if (this.metaWindow) {
                this.metaWindowThumbnail = new WindowThumbnail(this.metaWindow, this.app);
                this.appContainer.insert_actor(this.metaWindowThumbnail.actor, 0);
            }
        }

        // Get a list of all windows of our app that are running in the current workspace
        let windows = this.app.get_windows().filter(Lang.bind(this, function(win) {
                                                            let metaWorkspace = null;
                                                            if (this.metaWindow)
                                                                metaWorkspace = this.metaWindow.get_workspace();
                                                            let isDifferent = (win != this.metaWindow);
                                                            let isSameWorkspace = (win.get_workspace() == metaWorkspace);
                                                            return isDifferent && isSameWorkspace;
                                                    }));
        // Update appThumbnails to include new programs
        windows.forEach(Lang.bind(this, function(metaWindow) {
            if (this.appThumbnails[metaWindow]) {
                this.appThumbnails[metaWindow].thumbnail._refresh();
            } else if (GROUP_THUMBNAILS) {
                let thumbnail = new WindowThumbnail(metaWindow, this.app);
                this.appThumbnails[metaWindow] = { metaWindow: metaWindow,
                                                   thumbnail: thumbnail };
                this.appContainer.add_actor(this.appThumbnails[metaWindow].thumbnail.actor);
            }
        }));

        // Update appThumbnails to remove old programs
        for (let win in this.appThumbnails) {
            if (windows.indexOf(this.appThumbnails[win].metaWindow) == -1) {
                this.appContainer.remove_actor(this.appThumbnails[win].thumbnail.actor);
                this.appThumbnails[win].thumbnail.destroy();
                delete this.appThumbnails[win];
            }
        }
    }
};

function WindowThumbnail() {
    this._init.apply(this, arguments);
}

WindowThumbnail.prototype = {
    _init: function (metaWindow, app, params) {
        this.metaWindow = metaWindow
        this.app = app

        // Inherit the theme from the alt-tab menu
        this.actor = new St.BoxLayout({ style_class: 'item-box',
                                        reactive: true,
                                        track_hover: true,
                                        vertical: true});
        this.thumbnailActor = new St.Bin();
	this.ThumbnailHeight = Math.max(150, Main.layoutManager.primaryMonitor.height / THUMBNAIL_SIZE);
	this.ThumbnailWidth = Math.max(200, Main.layoutManager.primaryMonitor.width / THUMBNAIL_SIZE);
        this.thumbnailActor.height = this.ThumbnailHeight;
        this.thumbnailActor.width = this.ThumbnailWidth;

        let bin = new St.Bin({ name: 'appMenu' });
        this._container = new Cinnamon.GenericContainer();
        bin.set_child(this._container);
        this._container.connect('get-preferred-width',
								Lang.bind(this, this._getContentPreferredWidth));
        this._container.connect('get-preferred-height',
								Lang.bind(this, this._getContentPreferredHeight));
        this._container.connect('allocate', Lang.bind(this, this._contentAllocate));

        
        this._iconBox = new Cinnamon.Slicer({ name: 'appMenuIcon' });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this._container.add_actor(this._iconBox);
        this._label = new St.Label();
        this._container.add_actor(this._label);
	this.button = new St.Bin({ style_class: 'window-close', reactive: true });
	this.button.hide();
	this._container.add_actor(this.button);
        this.button.lower_bottom();

        this._iconBottomClip = 0;

	let icon = app.create_icon_texture(THUMBNAIL_ICON_SIZE);
        this._iconBox.set_child(icon);

        //TODO: should probably do this in a smarter way in the get_size_request event or something...
        //fixing this should also allow the text to be centered
        //this.titleActor.width = THUMBNAIL_WIDTH;
	this.actor.add_actor(bin);
        this.actor.add_actor(this.thumbnailActor);
        this._refresh();

        // the thumbnail actor will automatically reflect changes in the window
        // (since it is a clone), but we need to update the title when it changes
        this.metaWindow.connect('notify::title', Lang.bind(this, function(){
                                                    this._label.text = this.metaWindow.get_title();
                                }));
        this.actor.connect('enter-event', Lang.bind(this, function() {
                                                        this.actor.add_style_pseudo_class('outlined');
                                                        this.actor.add_style_pseudo_class('selected');
							this.button.show();
							this.stopClick = false;
							this.hoverPeek = true;
							Mainloop.timeout_add(HOVER_MENU_TIMEOUT + 500, Lang.bind(this, this._hoverPeek));
                                                    }));
        this.actor.connect('leave-event', Lang.bind(this, function() {
                                                        this.actor.remove_style_pseudo_class('outlined');
                                                        this.actor.remove_style_pseudo_class('selected');
							this.button.hide();
							this.hoverPeek = false;
							Mainloop.timeout_add(HOVER_MENU_TIMEOUT + 500, Lang.bind(this, this._hoverPeek));
                                                    }));
        this.button.connect('button-release-event', Lang.bind(this, this._onButtonRelease));

        this.actor.connect('button-release-event', Lang.bind(this, this._connectToWindow));
    },

    destroy: function() {
        this.actor.destroy();
    },

    needs_refresh: function() {
        return Boolean(this.thumbnail);
    },

    _getThumbnail: function() {
        // Create our own thumbnail if it doesn't exist
        if (this.thumbnail) {
            return this.thumbnail;
        }
        let thumbnail = null;
        let mutterWindow = this.metaWindow.get_compositor_private();
        if (mutterWindow) {
            let windowTexture = mutterWindow.get_texture();
            let [width, height] = windowTexture.get_size();
            let scale = Math.min(1.0, this.ThumbnailWidth / width, this.ThumbnailHeight / height);
            thumbnail = new Clutter.Clone ({ source: windowTexture,
                                             reactive: true,
                                             width: width * scale,
                                             height: height * scale });
        }

        return thumbnail;
    },

    _onButtonRelease: function(actor, event) {
        if ( Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK ) {
            this.metaWindow.delete(global.get_current_time());
        }
	this.stopClick = true;
    },

    _hoverPeek: function(actor, event) {
        /*if ( this.hoverPeek ) {
            this.metaWindow.opacity;
        }else {
            if ( !this.hoverPeek ) {
            	this.metaWindow.opacity = 1;
            }
	}*/
    },

    _connectToWindow: function(actor, event) {
        if ( Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK && !this.stopClick ) {
            this.metaWindow.activate(global.get_current_time());
        }
    },

    _refresh: function() {
        // Replace the old thumbnail
        this.thumbnail = null;
        this.thumbnail = this._getThumbnail();

        this.thumbnailActor.child = this.thumbnail;
        this._label.text = this.metaWindow.get_title();
    },
    _onIconBoxStyleChanged: function() {
        let node = this._iconBox.get_theme_node();
        this._iconBottomClip = node.get_length('panel-launcher-bottom-clip');
        this._updateIconBoxClip();
    },

    _updateIconBoxClip: function() {
        let allocation = this._iconBox.allocation;
        if (this._iconBottomClip > 0)
            this._iconBox.set_clip(0, 0, allocation.x2 - allocation.x1, allocation.y2 - allocation.y1 - this._iconBottomClip);
        else
            this._iconBox.remove_clip();
    },

    _getContentPreferredWidth: function(actor, forHeight, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_width(forHeight);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
        [minSize, naturalSize] = this._label.get_preferred_width(forHeight);
//        alloc.min_size = alloc.min_size + Math.max(0, minSize - Math.floor(alloc.min_size / 2));
        alloc.min_size = alloc.min_size + Math.max(0, minSize);
//        alloc.natural_size = alloc.natural_size + Math.max(0, naturalSize - Math.floor(alloc.natural_size / 2));
        alloc.natural_size = this.ThumbnailWidth; // FIX ME --> This was set to 75 originally, we need some calculation.. we want this to be as big as possible for the window list to take all available space
    },

    _getContentPreferredHeight: function(actor, forWidth, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_height(forWidth);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
        [minSize, naturalSize] = this._label.get_preferred_height(forWidth);
        if (minSize > alloc.min_size)
            alloc.min_size = minSize;
        if (naturalSize > alloc.natural_size)
            alloc.natural_size = naturalSize;
    },

    _contentAllocate: function(actor, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;
        let childBox = new Clutter.ActorBox();

        let [minWidth, minHeight, naturalWidth, naturalHeight] = this._iconBox.get_preferred_size();

        let direction = this.actor.get_direction();

        let yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);
        if (direction == St.TextDirection.LTR) {
            childBox.x1 = 3;
            childBox.x2 = childBox.x1 + Math.min(naturalWidth, allocWidth);
        } else {
            childBox.x1 = Math.max(0, allocWidth - naturalWidth);
            childBox.x2 = allocWidth;
        }
        this._iconBox.allocate(childBox, flags);

        let iconWidth = THUMBNAIL_ICON_SIZE;

        [minWidth, minHeight, naturalWidth, naturalHeight] = this._label.get_preferred_size();

        yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);

        if (direction == St.TextDirection.LTR) {
            childBox.x1 = Math.floor(iconWidth + 5);
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, allocWidth);
        } else {
            childBox.x2 = allocWidth - Math.floor(iconWidth + 3);
            childBox.x1 = Math.max(0, childBox.x2 - naturalWidth);
        }
        this._label.allocate(childBox, flags);

	let buttonSize = THUMBNAIL_ICON_SIZE;
        if (direction == St.TextDirection.LTR) {
            childBox.x1 = this.ThumbnailWidth - THUMBNAIL_ICON_SIZE;
            childBox.x2 = childBox.x1 + 36;
            childBox.y1 = iconWidth * (-1) - 3;
            childBox.y2 = iconWidth;
            this.button.allocate(childBox, flags);
        } else {
            childBox.x1 = -this.button.width;
            childBox.x2 = childBox.x1 + this.button.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this.button.allocate(childBox, flags);
        }
    }
};
