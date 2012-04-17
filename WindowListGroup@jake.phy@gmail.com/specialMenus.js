const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const AppFavorites = imports.ui.appFavorites;
const Tweener = imports.tweener.tweener;

// THUMBNAIL OPTIONS
const THUMBNAIL_ICON_SIZE = 16;
const HOVER_MENU_TIMEOUT = 500;
const THUMBNAIL_SIZE = 7;
const GROUP_THUMBNAILS = true;

var opacity_transparent = 128;
var opacity_opaque = 255;
var transition_time = 0.2;
//

const AppletDir = imports.ui.appletManager.applets['WindowListGroup@jake.phy@gmail.com'];
const MainApplet = AppletDir.applet;

function AppMenuButtonRightClickMenu() {
    this._init.apply(this, arguments);
}

AppMenuButtonRightClickMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(actor, metaWindow, app, isFavapp, orientation) {
        //take care of menu initialization        
        PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.0, orientation, 0);        
        Main.uiGroup.add_actor(this.actor);
        //Main.chrome.addActor(this.actor, { visibleInOverview: true,
        //                                   affectsStruts: false });
        this.actor.hide();
        this.metaWindow = metaWindow;
	this._parentActor = actor;
        this._parentActor.connect('button-release-event', Lang.bind(this, this._onParentActorButtonRelease));

        actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));        
        this.connect('open-state-changed', Lang.bind(this, this._onToggled));        

	this.orientation = orientation;
	this.app = app;
        this.isFavapp = isFavapp;

        this.itemCloseWindow = new PopupMenu.PopupMenuItem(_("Close"));
        this.itemCloseWindow.connect('activate', Lang.bind(this, this._onCloseWindowActivate));        

        this.itemMinimizeWindow = new PopupMenu.PopupMenuItem(_("Minimize"));
        this.itemMinimizeWindow.connect('activate', Lang.bind(this, this._onMinimizeWindowActivate));        
        
        this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_("Maximize"));
        this.itemMaximizeWindow.connect('activate', Lang.bind(this, this._onMaximizeWindowActivate));  
        
        this.itemMoveToLeftWorkspace = new PopupMenu.PopupMenuItem(_("Move to left workspace"));
        this.itemMoveToLeftWorkspace.connect('activate', Lang.bind(this, this._onMoveToLeftWorkspace));
        
        this.itemMoveToRightWorkspace = new PopupMenu.PopupMenuItem(_("Move to right workspace"));
        this.itemMoveToRightWorkspace.connect('activate', Lang.bind(this, this._onMoveToRightWorkspace));      
        
        this.itemOnAllWorkspaces = new PopupMenu.PopupMenuItem(_("Visible on all workspaces"));
        this.itemOnAllWorkspaces.connect('activate', Lang.bind(this, this._toggleOnAllWorkspaces));
	
	this.launchItem = new PopupMenu.PopupMenuItem(_('New Window'));
        this.launchItem.connect('activate', Lang.bind(this, this._launchMenu));

		this.favs = AppFavorites.getAppFavorites(),
		this.favId = this.app.get_id(),
		this.isFav = this.favs.isFavorite(this.favId);
	if (MainApplet.OPTIONS['SHOW_FAVORITES']) {
		if (this.isFav) {
		    this.itemtoggleFav = new PopupMenu.PopupMenuItem(_('Unpin Favorite'));
        	    this.itemtoggleFav.connect('activate', Lang.bind(this, this._toggleFav));     
		}else {
		    this.itemtoggleFav = new PopupMenu.PopupMenuItem(_('Pin To Favorites'));
        	    this.itemtoggleFav.connect('activate', Lang.bind(this, this._toggleFav));
		} 
	}
	if (isFavapp) {
	    this._makeFavapp();
	    return;
	}
	this._makeNormalapp();
    },

    _makeFavapp: function() {
        this.addMenuItem(this.launchItem);
        this.addMenuItem(this.itemtoggleFav);
    },

    _makeNormalapp: function() {
        if (this.orientation == St.Side.BOTTOM) {
            //this.addMenuItem(this.itemOnAllWorkspaces);
            this.addMenuItem(this.itemMoveToLeftWorkspace);
            this.addMenuItem(this.itemMoveToRightWorkspace);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	    if (MainApplet.OPTIONS['SHOW_FAVORITES'])
            	this.addMenuItem(this.itemtoggleFav);
       	    this.addMenuItem(this.launchItem);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.addMenuItem(this.itemMinimizeWindow);
            //this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemCloseWindow);                        
        }
        else {
            this.addMenuItem(this.itemCloseWindow);
            //this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemMinimizeWindow);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
       	    this.addMenuItem(this.launchItem);
	    if (MainApplet.OPTIONS['SHOW_FAVORITES'])
            	this.addMenuItem(this.itemtoggleFav);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.addMenuItem(this.itemMoveToLeftWorkspace);
            this.addMenuItem(this.itemMoveToRightWorkspace);
            //this.addMenuItem(this.itemOnAllWorkspaces);
        }
    },

    _onParentActorButtonRelease: function(actor, event) {
        if ( Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK ) {
            if ( this.isOpen ) {
                this.toggle();
            }
        } else if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON3_MASK) {
            this.mouseEvent = event;
            this.toggle();
        }   
    },

     _onToggled: function(actor, event){
	if (!event)
            return;

	if (this.metaWindow.is_on_all_workspaces()) {
            this.itemOnAllWorkspaces.label.set_text(_("Only on this workspace"));
            this.itemMoveToLeftWorkspace.actor.hide();
            this.itemMoveToRightWorkspace.actor.hide();
        } else {
            this.itemOnAllWorkspaces.label.set_text(_("Visible on all workspaces"));
            if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT) != this.metaWindow.get_workspace())
                this.itemMoveToLeftWorkspace.actor.show();
            else
                this.itemMoveToLeftWorkspace.actor.hide();
            
            if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT) != this.metaWindow.get_workspace())
                this.itemMoveToRightWorkspace.actor.show();
            else
                this.itemMoveToRightWorkspace.actor.hide();
        }
        if (this.metaWindow.get_maximized()) {
            this.itemMaximizeWindow.label.set_text(_("Unmaximize"));
        }else{
            this.itemMaximizeWindow.label.set_text(_("Maximize"));
        }
        if (this.metaWindow.minimized)
            this.itemMinimizeWindow.label.set_text(_("Restore"));
        else
            this.itemMinimizeWindow.label.set_text(_("Minimize"));
    },
    
    _onWindowMinimized: function(actor, event){
    },

    _onCloseWindowActivate: function(actor, event){
        this.metaWindow.delete(global.get_current_time());
        this.destroy();
    },

    _onMinimizeWindowActivate: function(actor, event){
        if (this.metaWindow.minimized) {
            this.metaWindow.unminimize(global.get_current_time());
            this.metaWindow.activate(global.get_current_time());
        }
        else {
            this.metaWindow.minimize(global.get_current_time());
        }
    },

    _onMaximizeWindowActivate: function(actor, event){      
        if (this.metaWindow.get_maximized()){
            this.metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }else{
            this.metaWindow.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }
    },
    
    _onMoveToLeftWorkspace: function(actor, event){
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT); 
        if (workspace) {
            this.actor.destroy();
            this.metaWindow.change_workspace(workspace);
            Main._checkWorkspaces();
        }
    },

    _onMoveToRightWorkspace: function(actor, event){
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT); 
        if (workspace) {
            this.actor.destroy();
            this.metaWindow.change_workspace(workspace);
            Main._checkWorkspaces();
        }
    },

    _toggleOnAllWorkspaces: function(actor, event) {
        if (this.metaWindow.is_on_all_workspaces())
            this.metaWindow.unstick();
        else
            this.metaWindow.stick();
    },

    _toggleFav: function(actor, event){
	if (this.isFav){
		this.favs.removeFavorite(this.favId)
		this.itemtoggleFav.label.set_text(_('Pin To Favorites'));
	}else{
		this.favs.addFavorite(this.favId);
		this.itemtoggleFav.label.set_text(_('Unpin Favorite'));
		}
    },

    _launchMenu: function(){
	this.app.open_new_window(-1);
    },

    removeAll: function() {
        let children = this._getMenuItems();
        for (let i = 0; i < children.length; i++) {
            let item = children[i];
            this.box.remove_actor(item.actor);
        }
    },

    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;
    },

    setMetaWindow: function(metaWindow) {
        this.metaWindow = metaWindow;
    }
};

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

    _init: function(actor, metaWindow, app, isFavapp, orientation) {
        PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.45, orientation);

        this.metaWindow = metaWindow;
	this.app = app     
        this.isFavapp = isFavapp;
  	this.actor.style_class = null;
	this.actor.set_style("-arrow-background-color: rgba(80,80,80,0.0);-arrow-border-color: rgba(150,150,150,0.0);");
        this.actor.hide();
	this.parentActor = actor;

        Main.layoutManager.addChrome(this.actor, this.orientation);

        this.appSwitcherItem = new PopupMenuAppSwitcherItem(this.metaWindow, this.app, isFavapp);
        this.addMenuItem(this.appSwitcherItem);

        this.parentActor.connect('enter-event', Lang.bind(this, this._onEnter));
        this.parentActor.connect('leave-event', Lang.bind(this, this._onLeave));
        this.parentActor.connect('button-press-event', Lang.bind(this, this._onButtonPress));

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
	this.appSwitcherItem.actor.show();
        this.appSwitcherItem._refresh();
        PopupMenu.PopupMenu.prototype.open.call(this, animate);
    },

    close: function(animate) {
        // Refresh all the thumbnails, etc when the menu opens.  These cannot
        // be created when the menu is initalized because a lot of the clutter window surfaces
        // have not been created yet...
	this.appSwitcherItem.actor.hide();
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

    _init: function (metaWindow, app, isFavapp, params) {
        params = Params.parse(params, { hover: false });
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.metaWindow = metaWindow;
        this.app = app;
        this.isFavapp = isFavapp;
        

        this.appContainer = new St.BoxLayout({ style_class: 'switcher-list'});
	this.appContainer.set_style("padding: 6px;border-radius: 12px;");
        this.appThumbnails = {};

        this._refresh();

        this.addActor(this.appContainer);
    },

    setMetaWindow: function(metaWindow) {
        this.metaWindow = metaWindow;
    },

    _makeFavapp: function() {
	this.isFavapp = true;
    },

    _makeNormalapp: function() {
	this.isFavapp = false;
    },

    _refresh: function() {
        // Check to see if this.metaWindow has changed.  If so, we need to recreate
        // our thumbnail, etc.
        if (this.metaWindowThumbnail && this.metaWindowThumbnail.metaWindow == this.metaWindow) {
	    if (this.isFavapp)
                this.metaWindowThumbnail._makeFavapp();
	    else
                this.metaWindowThumbnail._refresh();
        } else {
            if (this.metaWindowThumbnail) {
                this.metaWindowThumbnail.destroy();
            }
            // If our metaWindow is null, just move along
            if (this.metaWindow || this.isFavapp) {
                this.metaWindowThumbnail = new WindowThumbnail(this.metaWindow, this.app, this.isFavapp);
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
		if (this.isFavapp)
		    this.appThumbnails[metaWindow].thumbnail._makeFavapp();
		else
                    this.appThumbnails[metaWindow].thumbnail._refresh();
            } else {
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
    _init: function (metaWindow, app, isFavapp) {
        this.metaWindow = metaWindow
        this.app = app
        this.isFavapp = isFavapp;

        // Inherit the theme from the alt-tab menu
        this.actor = new St.BoxLayout({ style_class: 'item-box',
                                        reactive: true,
                                        track_hover: true,
                                        vertical: true});

        this.thumbnailActor = new St.Bin();
	this.ThumbnailHeight = Math.max(100, Main.layoutManager.primaryMonitor.height / MainApplet.OPTIONS['THUMBNAIL_SIZE']);
	this.ThumbnailWidth = Math.max(120, Main.layoutManager.primaryMonitor.width / MainApplet.OPTIONS['THUMBNAIL_SIZE']);

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
	this._container.add_actor(this.button);
	this.button.hide();
        this.button.raise_top();

        this._iconBottomClip = 0;

	let icon = this.app.create_icon_texture(THUMBNAIL_ICON_SIZE);
        this._iconBox.set_child(icon);

        //TODO: should probably do this in a smarter way in the get_size_request event or something...
        //fixing this should also allow the text to be centered
        //this.titleActor.width = THUMBNAIL_WIDTH;
	this.actor.add_actor(bin);
        this.actor.add_actor(this.thumbnailActor);
	if (isFavapp)
	    this._makeFavapp();
	else
            this._refresh();

        if (this.metaWindow)
	    this.metaWindow.connect('notify::title', Lang.bind(this, function(){
                                    this._label.text = this.metaWindow.get_title()}));	
        this.actor.connect('enter-event', Lang.bind(this, function() {
                                                        this.actor.add_style_pseudo_class('outlined');
                                                        this.actor.add_style_pseudo_class('selected');
							if (!this.button.stopShow)
							    this.button.show();
							this.stopClick = false}));
        this.actor.connect('leave-event', Lang.bind(this, function() {
                                                        this.actor.remove_style_pseudo_class('outlined');
                                                        this.actor.remove_style_pseudo_class('selected');
							this.button.hide();
							}));
        this.button.connect('button-release-event', Lang.bind(this, this._onButtonRelease));

        this.actor.connect('button-release-event', Lang.bind(this, this._connectToWindow));
    },

    _makeFavapp: function() {
	this.thumbnailActor.height = 0;
 	this.thumbnailActor.width = 0;
        this.thumbnailActor.child = null;
	this.apptext = this.app.get_name();
	this._label.text = this.apptext;
	this.ThumbnailWidth = Math.floor(this.apptext.length * 9);
	this.button.stopShow = true;
	this.isFavapp = true;
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
	    this.stopClick = true;
        }
    },

    _connectToWindow: function(actor, event) {
        if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK && this.isFavapp) {
	        this.app.open_new_window(-1);
                return;
        }
        if ( Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK && !this.stopClick) {
            this.metaWindow.activate(global.get_current_time());
        }
    },

    _refresh: function() {
        // Replace the old thumbnail
	this.ThumbnailWidth = Math.max(200, Main.layoutManager.primaryMonitor.width / MainApplet.OPTIONS['THUMBNAIL_SIZE']);
        this.thumbnailActor.height = this.ThumbnailHeight;
        this.thumbnailActor.width = this.ThumbnailWidth;
	this.button.stopShow = false;
	this.isFavapp = false;

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
        alloc.natural_size = Math.max(this.ThumbnailWidth, 50); // FIX ME --> This was set to 75 originally, we need some calculation.. we want this to be as big as possible for the window list to take all available space
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
