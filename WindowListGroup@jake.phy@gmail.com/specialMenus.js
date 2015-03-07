/* jshint moz:true */
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;
const Meta = imports.gi.Meta;
const Util = imports.misc.util;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Tweener = imports.ui.tweener;
const Tooltips = imports.ui.tooltips;

const AppletDir = imports.ui.appletManager.applets['WindowListGroup@jake.phy@gmail.com'];
const MainApplet = AppletDir.applet;
const SpecialButtons = AppletDir.specialButtons;
const SpecialMenuItems = AppletDir.specialMenuItems;
const FireFox = AppletDir.firefox;

const THUMBNAIL_ICON_SIZE = 16;
const OPACITY_OPAQUE = 255;

const FavType = {
    favorites: 0,
    pinnedApps: 1,
    none: 2
};

function AppMenuButtonRightClickMenu() {
    this._init.apply(this, arguments);
}

AppMenuButtonRightClickMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function (parent, actor) {
        //take care of menu initialization        
        PopupMenu.PopupMenu.prototype._init.call(this, parent.actor, 0.0, parent.orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        //Main.chrome.addActor(this.actor, { visibleInOverview: true,
        //                                   affectsStruts: false });
        this.actor.hide();
        this.metaWindow = parent.metaWindow;
        this._parentActor = actor;
        this._parentActor.connect('button-release-event', Lang.bind(this, this._onParentActorButtonRelease));

        actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
        this.connect('open-state-changed', Lang.bind(this, this._onToggled));

        this.orientation = parent.orientation;
        this.app = parent.app;
        this.isFavapp = parent.isFavapp;
        this._applet = parent._applet;
		this.showCloseAll = this._applet.settings.getValue("closeall-menu-item");
		this.AppMenuWidth = this._applet.settings.getValue("appmenu-width");
        
        let PinnedFavorites = this._applet.pinned_app_contr();

		this.monitorItems = [];
		let monitors = Main.layoutManager.monitors;
		if (monitors.length > 1) {
			for(let i = 0; i < monitors.length; i++){
				let itemChangeMonitor = new SpecialMenuItems.IconNameMenuItem(this, _("Move to monitor {0}").format(i + 1));
				itemChangeMonitor.connect('activate', Lang.bind(this, function() {
					this.metaWindow.move_to_monitor(i);
				}));
				this.monitorItems.push(itemChangeMonitor);
			}
		}

		this.appInfo = this.app.get_app_info();

		// Pause for refresh of SpecialItems.
	    this._applet.recentManager.connect('changed', Lang.bind(this, function(){Mainloop.timeout_add(15, Lang.bind(this, this._recent_items_changed))}));
        this._applet.settings.connect('changed::pinned-recent', Lang.bind(this, this._recent_items_changed));
        this._applet.settings.connect('changed::show-recent', Lang.bind(this, this._recent_items_changed));
        this._applet.settings.connect('changed::appmenu-width', Lang.bind(this, this._appMenu_width_changed));

        this.itemCloseAllWindow = new SpecialMenuItems.IconNameMenuItem(this,_("Close All"), "window-close");
        this.itemCloseAllWindow.connect('activate', Lang.bind(this, this._onCloseAllActivate));

        this.itemCloseWindow = new SpecialMenuItems.IconNameMenuItem(this,_("Close"), "window-close");
        this.itemCloseWindow.connect('activate', Lang.bind(this, this._onCloseWindowActivate));

        this.itemMinimizeWindow = new SpecialMenuItems.IconNameMenuItem(this, _("Minimize"));
        this.itemMinimizeWindow.connect('activate', Lang.bind(this, this._onMinimizeWindowActivate));

        this.itemMaximizeWindow = new SpecialMenuItems.IconNameMenuItem(this, _("Maximize"));
        this.itemMaximizeWindow.connect('activate', Lang.bind(this, this._onMaximizeWindowActivate));

        this.itemMoveToLeftWorkspace = new SpecialMenuItems.IconNameMenuItem(this,_("Move to left workspace"), "back");
        this.itemMoveToLeftWorkspace.connect('activate', Lang.bind(this, this._onMoveToLeftWorkspace));

        this.itemMoveToRightWorkspace = new SpecialMenuItems.IconNameMenuItem(this,_("Move to right workspace"), "next");
        this.itemMoveToRightWorkspace.connect('activate', Lang.bind(this, this._onMoveToRightWorkspace));

        this.itemOnAllWorkspaces = new SpecialMenuItems.IconNameMenuItem(this,_("Visible on all workspaces"), "edit-copy");
        this.itemOnAllWorkspaces.connect('activate', Lang.bind(this, this._toggleOnAllWorkspaces));

        this.launchItem = new SpecialMenuItems.IconMenuItem(this, this.app.get_name(), this.app.create_icon_texture(16));
        this.launchItem.connect('activate', Lang.bind(this, function(){
			this.appInfo.launch([], null);
		}));
		// Settings in pinned apps menu;
		this._settingsMenu();
		this.specialCont = new SpecialMenuItems.SubSection();
		this.specialCont.box = new St.BoxLayout({
			vertical: true,
        });

		this.specialSection = new St.BoxLayout({vertical: true});
		this.specialCont.box.add(this.specialSection);
		this.specialCont.addActor(this.specialCont.box,{span: -1});
		this.addSpecialItems();

        this.favs = PinnedFavorites;
        this.favId = this.app.get_id();
        this.isFav = this.favs.isFavorite(this.favId);

        if (this._applet.showPinned != FavType.none) {
            if (this.isFav) {
                this.itemtoggleFav = new SpecialMenuItems.IconNameMenuItem(this,_("Unpin from Panel"), "remove");
                this.itemtoggleFav.connect('activate', Lang.bind(this, this._toggleFav));
            } else {
                this.itemtoggleFav = new SpecialMenuItems.IconNameMenuItem(this,_("Pin to Panel"), "bookmark-new");
                this.itemtoggleFav.connect('activate', Lang.bind(this, this._toggleFav));
            }
        }
        if (this.isFavapp) this._isFavorite(true);
        else this._isFavorite(false);
    },

    _settingsMenu: function(){
		this.subMenuItem = new SpecialMenuItems.SubMenuItem(this, _("Settings"));
		let subMenu = this.subMenuItem.menu;

		this.reArrange = new SpecialMenuItems.SwitchMenuItem(this, _("ReArrange"), this._applet.arrangePinned);
		this.reArrange.connect('toggled', Lang.bind(this, function(item) { this._applet.arrangePinned = item.state; }));
		subMenu.addMenuItem(this.reArrange);

		this.showPinned = new SpecialMenuItems.SwitchMenuItem(this, _("Show Pinned"), this._applet.showPinned);
		this.showPinned.connect('toggled', Lang.bind(this, function(item) { this._applet.showPinned = item.state; }));
		subMenu.addMenuItem(this.showPinned);

		this.groupApps = new SpecialMenuItems.SwitchMenuItem(this, _("Group Apps"), this._applet.groupApps);
		this.groupApps.connect('toggled', Lang.bind(this, function(item) { this._applet.groupApps = item.state; }));
		subMenu.addMenuItem(this.groupApps);

		this.showThumbs = new SpecialMenuItems.SwitchMenuItem(this, _("Show Thumbs"), this._applet.showThumbs);
		this.showThumbs.connect('toggled', Lang.bind(this, function(item) { this._applet.showThumbs = item.state; }));
		subMenu.addMenuItem(this.showThumbs);

		this.stackThumbs =  new SpecialMenuItems.SwitchMenuItem(this, _("Stack Thumbs"), this._applet.stackThumbs);
		this.stackThumbs.connect('toggled', Lang.bind(this, function(item) { this._applet.stackThumbs = item.state; }));
		this.subMenuItem.menu.addMenuItem(this.stackThumbs);

		this.enablePeek = new SpecialMenuItems.SwitchMenuItem(this, _("Hover to Peek"), this._applet.enablePeek);
		this.enablePeek.connect('toggled', Lang.bind(this, function(item) { this._applet.enablePeek = item.state; }));
		this.subMenuItem.menu.addMenuItem(this.enablePeek);

		this.showRecent = new SpecialMenuItems.SwitchMenuItem(this, _("Show Recent"), this._applet.showRecent);
		this.showRecent.connect('toggled', Lang.bind(this, function(item) { this._applet.showRecent = item.state; }));
		this.subMenuItem.menu.addMenuItem(this.showRecent);

		this.verticalThumbs = new SpecialMenuItems.SwitchMenuItem(this, _("Vertical Thumbs"), this._applet.verticalThumbs);
		this.verticalThumbs.connect('toggled', Lang.bind(this, function(item) { this._applet.verticalThumbs = item.state; }));
		this.subMenuItem.menu.addMenuItem(this.verticalThumbs);

        this.settingItem = new SpecialMenuItems.IconNameMenuItem(this,_("   Go to Settings"));
        this.settingItem.connect('activate', Lang.bind(this, this._settingMenu));
		subMenu.addMenuItem(this.settingItem);
	},

	_recent_items_changed: function() {
		this.specialCont.actor.track_hover = true;
		let children = this.specialSection.get_children();
		for(let i = 0;i < children.length;i++){
			this.specialSection.remove_actor(children[i]);
			children[i].destroy();
		}
		this.addSpecialItems();
		this.specialCont.actor.track_hover = false;
	},

	_appMenu_width_changed: function() {
		this.AppMenuWidth = this._applet.settings.getValue("appmenu-width") || 295;
		let children = this.RecentMenuItems.filter(Lang.bind(this, function (child) {
			if(child instanceof PopupMenu.PopupSeparatorMenuItem)
				return false;
			else
				return true; 
		})); ;
		for(let i = 0; i < children.length;i++) {
			let item = children[i];
			item.table.width = this.AppMenuWidth;
			item.label.width = this.AppMenuWidth - 26;
		}
		children = this.subMenuItem.menu.box.get_children().map(function (actor) {
            return actor._delegate;
        });
		for(let i = 0; i < children.length;i++) {
			let item = children[i];
			item.table.width = this.AppMenuWidth - 14;
			item.label.width = this.AppMenuWidth - 74;
		}
		children = this.box.get_children().map(function (actor) {
            return actor._delegate;
        }).filter(Lang.bind(this, function (child) {
			if(child instanceof SpecialMenuItems.IconNameMenuItem || child instanceof SpecialMenuItems.IconMenuItem || child instanceof SpecialMenuItems.SubMenuItem)
				return true;
			else
				return false; 
		})); 
		for(let i = 0; i < children.length;i++) {
			let item = children[i];
			item.table.width = this.AppMenuWidth;
			item.label.width = this.AppMenuWidth - 26;
		}
	},

	addSpecialItems: function() {
		this.RecentMenuItems = [];
		if(!this._applet.showRecent) return;
		// Load Pinned
		let pinnedLength = this._listPinned() || 0;
		// Load Places
		if (this.app.get_id() == 'nemo.desktop' || this.app.get_id() == 'nemo-home.desktop'){
            let defualtPlaces = this._listDefaultPlaces();
            let bookmarks = this._listBookmarks();
            let devices = this._listDevices();
            let places = defualtPlaces.concat(bookmarks).concat(devices);
            for (let i = 0; i < places.length; i++) {
				let item = new SpecialMenuItems.PlaceMenuItem(this, places[i]);
            	this.specialSection.add(item.actor);
				this.RecentMenuItems.push(item);
			}
			return;
		} else if(this.app.get_id() == 'firefox.desktop' || this.app.get_id() == 'firefox web browser.desktop'){
			let historys = FireFox.getFirefoxHistory(this._applet);

			if (historys === null) {
				let install = new SpecialMenuItems.IconNameMenuItem(this, _("Install Gda"));
        		install.connect('activate', Lang.bind(this, function(){
        			Util.spawnCommandLine('gnome-terminal -x bash -c "sudo apt-get install gir1.2-gda-5.0; echo "press enter and restart cinnamon"; read n1"');
			    }));
		    	this.addActor(install.actor);
			} else if(historys.length){
	 			try {
					historys.length = historys.length;
					for(let i = 0; i < historys.length; i++){
						let history = historys[i];
						if (this.pinnedItemsUris.indexOf(history.uri) != -1)
						continue;
						let item = new SpecialMenuItems.FirefoxMenuItem(this, history);
            			this.specialSection.add(item.actor);
						this.RecentMenuItems.push(item);
					}
				} catch(e){}
			}
			this._loadActions();
			return;
		}
		// Load Recent Items
		this._listRecent(pinnedLength);
		// Load Actions
		this._loadActions();
	},

    _loadActions: function(){
		if(!this.appInfo) return;
		let actions;
		try{
			actions = this.appInfo.list_actions();
		} catch(e) {
			log("Error:  This version of cinnamon does not support actions.");
			return;
		}
		if(actions.length && this.RecentMenuItems.length){
			let seperator = new PopupMenu.PopupSeparatorMenuItem();
			this.specialSection.add(seperator.actor);
			this.RecentMenuItems.push(seperator);
		}
		for(let i = 0; i < actions.length; i++){
			let action = actions[i];
			let actionItem = new SpecialMenuItems.IconNameMenuItem(this,this.appInfo.get_action_name(action), "window-new");
       		actionItem.connect('activate', Lang.bind(this, function(){
			    this.appInfo.launch_action(action, global.create_app_launch_context());
				this.toggle();
			}));
            this.specialSection.add(actionItem.actor);
			this.RecentMenuItems.push(actionItem);
		}
    },

	_listPinned: function(pattern){
		this.pinnedItemsUris = [];
		let pinnedRecent = this._applet.pinnedRecent;
		let appName = this.app.get_name();
		let pinnedLength;
		if(pinnedRecent[appName]){
			this.pinnedItems = pinnedRecent[appName].infos;
			pinnedLength = Object.keys(this.pinnedItems).length;
		}
		if(this.pinnedItems){
			for(let i in this.pinnedItems){
				let item = this.pinnedItems[i];
				//log(item.title)
				let recentMenuItem;
				if (item.title)
				 	recentMenuItem = new SpecialMenuItems.PinnedRecentItem(this, item.uri, "list-remove", item.title);
				else
					recentMenuItem = new SpecialMenuItems.PinnedRecentItem(this, item.uri, "list-remove");
            	this.specialSection.add(recentMenuItem.actor);
				this.pinnedItemsUris.push(recentMenuItem.uri);
				this.RecentMenuItems.push(recentMenuItem);
			}
		}
		return pinnedLength;
	},

    _listRecent: function(pinnedLength){
        let recentItems = this._applet.recent_items_contr();
		let items = [];
        for(let id = 0; id < recentItems.length; id++){
			let itemInfo = recentItems[id];
			let mimeType = itemInfo.get_mime_type();
			let appInfo = Gio.app_info_get_default_for_type(mimeType, false);
			if(appInfo && this.appInfo && appInfo.get_id() == this.appInfo.get_id() && this.pinnedItemsUris.indexOf(itemInfo.get_uri()) == -1)
				items.push(itemInfo);
		}
		let itemsLength = items.length;
		let num = this._applet.appMenuNum - pinnedLength;
		if(itemsLength > num)
			itemsLength = num;
		for(let i = 0; i < itemsLength; i++){
			let item = items[i];
			let recentMenuItem = new SpecialMenuItems.RecentMenuItem(this, item, 'list-add');
            this.specialSection.add(recentMenuItem.actor);
			this.RecentMenuItems.push(recentMenuItem);
		}
	},

    _listDefaultPlaces: function(pattern){
		let defaultPlaces = Main.placesManager.getDefaultPlaces();
		var res = [];
		for (let id = 0; id < defaultPlaces.length; id++) {
		  if (!pattern || defaultPlaces[id].name.toLowerCase().indexOf(pattern)!=-1) res.push(defaultPlaces[id]);
		}
		return res;
    },

    _listBookmarks: function(pattern){
		let bookmarks = Main.placesManager.getBookmarks();
		var res = [];
		for (let id = 0; id < bookmarks.length; id++) {
		  if (!pattern || bookmarks[id].name.toLowerCase().indexOf(pattern)!=-1) res.push(bookmarks[id]);
		}
		return res;
    },
    
    _listDevices: function(pattern){
       let devices = Main.placesManager.getMounts();
       var res = [];
       for (let id = 0; id < devices.length; id++) {
          if (!pattern || devices[id].name.toLowerCase().indexOf(pattern)!=-1) res.push(devices[id]);
       }
       return res;
    },

    _isFavorite: function (isFav) {
        let showFavs = this._applet.showPinned;
        if (isFav) {
			this.box.add(this.subMenuItem.menu.actor);
			this.addMenuItem(this.subMenuItem);
            this._connectSubMenuSignals(this.subMenuItem, this.subMenuItem.menu);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			if(this.RecentMenuItems.length){
				this.box.add(this.specialCont.actor);
			}
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.addMenuItem(this.launchItem);
            this.addMenuItem(this.itemtoggleFav);
			this.isFavapp = true;
        } else if (this.orientation == St.Side.BOTTOM) {
			if(this.monitorItems.length){
				this.monitorItems.forEach(function(item){
					this.addMenuItem(item);
				}, this);
				this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			}
            this.addMenuItem(this.itemOnAllWorkspaces);
            this.addMenuItem(this.itemMoveToLeftWorkspace);
            this.addMenuItem(this.itemMoveToRightWorkspace);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			if(this.RecentMenuItems.length) {
				this.box.add(this.specialCont.actor);
			}
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.addMenuItem(this.launchItem);
            if (showFavs) this.addMenuItem(this.itemtoggleFav);
            else this.addMenuItem(this.settingItem);
            //this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            //this.addMenuItem(this.itemMinimizeWindow);
            //this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemCloseWindow);
            if(this.showCloseAll) { this.addMenuItem(this.itemCloseAllWindow); }
			this.isFavapp = false;
        } else {
            this.addMenuItem(this.itemCloseWindow);
            if(this.showCloseAll) { this.addMenuItem(this.itemCloseAllWindow); }
            //this.addMenuItem(this.itemMaximizeWindow);
            //this.addMenuItem(this.itemMinimizeWindow);
            //this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            if (showFavs) this.addMenuItem(this.itemtoggleFav);
            else this.addMenuItem(this.settingItem);
            this.addMenuItem(this.launchItem);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			if(this.RecentMenuItems.length) {
				this.box.add(this.specialCont.actor);
			}
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.addMenuItem(this.itemMoveToLeftWorkspace);
            this.addMenuItem(this.itemMoveToRightWorkspace);
            this.addMenuItem(this.itemOnAllWorkspaces);
		 	if(this.monitorItems.length){
				this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
				this.monitorItems.forEach(function(item){
					this.addMenuItem(item);
				}, this);
			}
			this.isFavapp = false;
        }
    },

    _onParentActorButtonRelease: function (actor, event) {

        if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK) {
            if (this.isOpen) {
                this.toggle();
            }
        } else if (event.get_state() & Clutter.ModifierType.BUTTON2_MASK) {
            this.close(false);
        } else if (event.get_state() & Clutter.ModifierType.BUTTON3_MASK && !global.settings.get_boolean("panel-edit-mode")) {
            this.mouseEvent = event;
            this.toggle();
        }
    },

    _onToggled: function (actor, event) {
        if (!event || !this.metaWindow || !this.metaWindow.get_workspace()) return;

        if (this.metaWindow.is_on_all_workspaces()) {
            this.itemOnAllWorkspaces.label.text = _("Only on this workspace");
            this.itemMoveToLeftWorkspace.actor.hide();
            this.itemMoveToRightWorkspace.actor.hide();
        } else {
            this.itemOnAllWorkspaces.label.text = _("Visible on all workspaces");
            if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT) != this.metaWindow.get_workspace()) this.itemMoveToLeftWorkspace.actor.show();
            else this.itemMoveToLeftWorkspace.actor.hide();

            if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT) != this.metaWindow.get_workspace()) this.itemMoveToRightWorkspace.actor.show();
            else this.itemMoveToRightWorkspace.actor.hide();
        }
        if (this.metaWindow.get_maximized()) {
            this.itemMaximizeWindow.label.text = _("Unmaximize");
        } else {
            this.itemMaximizeWindow.label.text = _("Maximize");
        }
        if (this.metaWindow.minimized) this.itemMinimizeWindow.label.text = _("Restore");
        else this.itemMinimizeWindow.label.text = _("Minimize");
    },

    _onWindowMinimized: function (actor, event) {},

    _onCloseAllActivate: function (actor, event) {
        var workspace = this.metaWindow.get_workspace(); 
        var windows = this.app.get_windows();
        for(var i = 0; i < windows.length; i++) {
            windows[i].delete(global.get_current_time());
        }
    },

    _onCloseWindowActivate: function (actor, event) {
        this.metaWindow.delete(global.get_current_time());
        //this.destroy();
    },

    _onMinimizeWindowActivate: function (actor, event) {
        if (this.metaWindow.minimized) {
            this.metaWindow.unminimize(global.get_current_time());
            this.metaWindow.activate(global.get_current_time());
        } else {
            this.metaWindow.minimize(global.get_current_time());
        }
    },

    _onMaximizeWindowActivate: function (actor, event) {
        if (this.metaWindow.get_maximized()) {
            this.metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        } else {
            this.metaWindow.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }
    },

    _onMoveToLeftWorkspace: function (actor, event) {
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT);
        if (workspace) {
            //this.actor.destroy();
            this.metaWindow.change_workspace(workspace);
            Main._checkWorkspaces();
        }
    },

    _onMoveToRightWorkspace: function (actor, event) {
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT);
        if (workspace) {
            //this.actor.destroy();
            this.metaWindow.change_workspace(workspace);
            Main._checkWorkspaces();
        }
    },

    _toggleOnAllWorkspaces: function (actor, event) {
        if (this.metaWindow.is_on_all_workspaces()) this.metaWindow.unstick();
        else this.metaWindow.stick();
    },

    _toggleFav: function (actor, event) {
        if (this.isFav) {
            //this.close(false);
            this.favs.removeFavorite(this.favId);
        } else {
            //this.close(false);
            this.favs.addFavorite(this.favId);
        }
    },

    _settingMenu: function () {
        Util.spawnCommandLine("cinnamon-settings applets WindowListGroup@jake.phy@gmail.com");
    },

    removeItems: function () {
		this.blockSourceEvents = true;
        let children = this._getMenuItems();
        for (let i = 0; i < children.length; i++) {
            let item = children[i];
            this.box.remove_actor(item.actor);
        }
		this.blockSourceEvents = false;
    },

	destroy: function () {
		let items = this.RecentMenuItems;
		for(let i = 0; i < items.length; i++){
			items[i].destroy();
		}
		let children = this.subMenuItem.menu._getMenuItems();
        for (let i = 0; i < children.length; i++) {
            let item = children[i];
            //this.box.remove_actor(item.actor);
			item.destroy();
        }
		this.subMenuItem.menu.destroy();
        children = this._getMenuItems();
        for (let i = 0; i < children.length; i++) {
            let item = children[i];
            //this.box.remove_actor(item.actor);
			item.destroy();
        }
		this.box.destroy();
		this.actor.destroy();
    },

    _onSourceKeyPress: function (actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen) this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else return false;
    },

    setMetaWindow: function (metaWindow) {
        this.metaWindow = metaWindow;
    }
};

function HoverMenuController(owner) {
    this._init(owner);
}

HoverMenuController.prototype = {
    __proto__: PopupMenu.PopupMenuManager.prototype,

    _onEventCapture: function (actor, event) {
        return false;
    }
};

function AppThumbnailHoverMenu() {
    this._init.apply(this, arguments);
}

AppThumbnailHoverMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function (parent) {
        PopupMenu.PopupMenu.prototype._init.call(this, parent.actor, 0.45, parent.orientation);
		this._applet = parent._applet;
        this.metaWindow = parent.metaWindow;
        this.app = parent.app;
        this.isFavapp = parent.isFavapp;
		//need to impliment this class or cinnamon outputs a bunch of errors
        this.actor.style_class = "hide-arrow";

		this.box.style_class = "thumbnail-popup-content";

        this.actor.hide();
        this.parentActor = parent.actor;

        Main.layoutManager.addChrome(this.actor, this.orientation);

        this.appSwitcherItem = new PopupMenuAppSwitcherItem(this);
        this.addMenuItem(this.appSwitcherItem);

        this.parentActor.connect('enter-event', Lang.bind(this, this._onEnter));
        this.parentActor.connect('leave-event', Lang.bind(this, this._onLeave));
        this.parentActor.connect('button-release-event', Lang.bind(this, this._onButtonPress));

        this.actor.connect('enter-event', Lang.bind(this, this._onMenuEnter));
        this.actor.connect('leave-event', Lang.bind(this, this._onMenuLeave));

        //this.actor.connect('button-release-event', Lang.bind(this, this._onButtonPress));
        this._applet.settings.connect('thumbnail-timeout', Lang.bind(this, function () { this.hoverTime =  this._applet.settings.getValue("thumbnail-timeout"); }));
        this.hoverTime =  this._applet.settings.getValue("thumbnail-timeout");
    },

    _onButtonPress: function (actor, event) {
		if(this._applet.onclickThumbs && this.appSwitcherItem.appContainer.get_children().length > 1) return;
        this.shouldOpen = false;
        this.shouldClose = true;
        Mainloop.timeout_add(this.hoverTime, Lang.bind(this, this.hoverClose));
    },

    _onMenuEnter: function () {
        this.shouldOpen = true;
        this.shouldClose = false;

        Mainloop.timeout_add(this.hoverTime, Lang.bind(this, this.hoverOpen));
    },

    _onMenuLeave: function () {
        this.shouldOpen = false;
        this.shouldClose = true;
        Mainloop.timeout_add(this.hoverTime, Lang.bind(this, this.hoverClose));
    },

    _onEnter: function () {
        this.shouldOpen = true;
        this.shouldClose = false;

        Mainloop.timeout_add(this.hoverTime, Lang.bind(this, this.hoverOpen));
    },

    _onLeave: function () {
        this.shouldClose = true;
        this.shouldOpen = false;

        Mainloop.timeout_add(this.hoverTime, Lang.bind(this, this.hoverClose));
    },

    hoverOpen: function () {
        if (this.shouldOpen && !this.isOpen) {
            this.open(true);
        }
    },

    hoverClose: function () {
        if (this.shouldClose) {
            this.close(true);
        }
    },

    open: function (animate) {
        // Refresh all the thumbnails, etc when the menu opens.  These cannot
        // be created when the menu is initalized because a lot of the clutter window surfaces
        // have not been created yet...
	    this.appSwitcherItem._refresh();
	    this.appSwitcherItem.actor.show();
	    PopupMenu.PopupMenu.prototype.open.call(this, animate);
    },

    close: function (animate) {
        // Refresh all the thumbnails, etc when the menu opens.  These cannot
        // be created when the menu is initalized because a lot of the clutter window surfaces
        // have not been created yet...
        PopupMenu.PopupMenu.prototype.close.call(this, animate);
        this.appSwitcherItem.actor.hide();
    },

	destroy: function () {
        let children = this._getMenuItems();
        for (let i = 0; i < children.length; i++) {
            let item = children[i];
            this.box.remove_actor(item.actor);
			item.actor.destroy();
        }
		this.box.destroy();
		this.actor.destroy();
    },


    setMetaWindow: function (metaWindow) {
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

    _init: function (parent, params) {
        params = Params.parse(params, {
            hover: false,
			activate:false
        });
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
        
		this._applet = parent._applet;
        this.metaWindow = parent.metaWindow;
        this.app = parent.app;
        this.isFavapp = parent.isFavapp;
		this._parentContainer = parent;
		this.metaWindows = {};
        this.actor.style_class = '';

        this.box = new St.BoxLayout();
        this.box1 = new St.BoxLayout();
        this.box2 = new St.BoxLayout();
        this.box3 = new St.BoxLayout();

        this.appContainer = new St.BoxLayout({
            style_class: 'switcher-list',
        });
		this.appContainer.style = "padding: 5px;";
		this.appContainer.add_style_class_name('thumbnail-row');

        this.appContainer2 = new St.BoxLayout({
            style_class: 'switcher-list',
        });
		this.appContainer2.style = "padding: 5px;";
		this.appContainer2.add_style_class_name('thumbnail-row');
		this.appContainer2.hide();

        this.appContainer3 = new St.BoxLayout({
            style_class: 'switcher-list',
        });
		this.appContainer3.style = "padding: 5px;";
		this.appContainer3.add_style_class_name('thumbnail-row');
		this.appContainer3.hide();

        this.appThumbnails = {};
        this.appThumbnails2 = {};
        this.appThumbnails3 = {};

        this._applet.settings.connect("changed::vertical-thumbnails", Lang.bind(this, this._setVerticalSetting));
		this._setVerticalSetting();
		this.addActor(this.box);

        this._refresh();
    },

	_setVerticalSetting: function() {
		let vertical = this._applet.settings.getValue("vertical-thumbnails");
		if(vertical){
			if(this.box.get_children() > 0) {
				this.box.remove_actor(this.appContainer3);
        		this.box.remove_actor(this.appContainer2);
				this.box.remove_actor(this.appContainer);
		        this.box.add_actor(this.appContainer);
        		this.box.add_actor(this.appContainer2);
				this.box.add_actor(this.appContainer3);
			}else{
		        this.box.add_actor(this.appContainer);
        		this.box.add_actor(this.appContainer2);
				this.box.add_actor(this.appContainer3);
			}	
		}else{
			if(this.box.get_children() > 0) {
				this.box.remove_actor(this.appContainer3);
        		this.box.remove_actor(this.appContainer2);
				this.box.remove_actor(this.appContainer);
		        this.box.add_actor(this.appContainer3);
        		this.box.add_actor(this.appContainer2);
				this.box.add_actor(this.appContainer);
			}else{
		        this.box.add_actor(this.appContainer3);
        		this.box.add_actor(this.appContainer2);
				this.box.add_actor(this.appContainer);
			}
		}
		this.appContainer.vertical = vertical;
		this.appContainer2.vertical = vertical;
		this.appContainer3.vertical = vertical;
		this.box.vertical = !vertical;
	},

    setMetaWindow: function (metaWindow) {
        this.metaWindow = metaWindow;
    },

    _isFavorite: function (isFav) {
        if (isFav) {
			this.isFavapp = true;
		} else {
			this.isFavapp = false;
		}
    },

	getMetaWindows: function() {
		let windows = this.app.get_windows().filter(Lang.bind(this, function (win) {
            let metaWorkspace = null;
            if (this.metaWindow) metaWorkspace = this.metaWindow.get_workspace();
            //let isDifferent = (win != this.metaWindow);
            let isSameWorkspace = (win.get_workspace() == metaWorkspace) && Main.isInteresting(win);
            return isSameWorkspace;
        })).reverse();
		return windows;
	},

    _refresh: function () {
        // Check to see if this.metaWindow has changed.  If so, we need to recreate
        // our thumbnail, etc.
		if(this.metaWindowThumbnail && this.metaWindowThumbnail.needs_refresh())
			this.metaWindowThumbnail = null;
        if (this.metaWindowThumbnail && this.metaWindowThumbnail.metaWindow == this.metaWindow) {
            this.metaWindowThumbnail._isFavorite(this.isFavapp);
        } else {
            if (this.metaWindowThumbnail) {
                this.metaWindowThumbnail.destroy();
            }
            // If our metaWindow is null, just move along
            if (this.isFavapp) {
                this.metaWindowThumbnail = new WindowThumbnail(this, this.metaWindow);
                this.appContainer.insert_actor(this.metaWindowThumbnail.actor, 0);
            }
        }

        // Get a list of all windows of our app that are running in the current workspace
        let windows = this.getMetaWindows();
        // Update appThumbnails to include new programs
		this.addNewWindows(windows);
        // Update appThumbnails to remove old programs
		this.removeOldWindows(windows);
		// used to make sure everything is on the stage
		Mainloop.timeout_add(0, Lang.bind(this, function(){this.setThumbnailIconSize(windows)}));
    },
	addNewWindows: function (windows) {
        let ThumbnailWidth = Math.floor((Main.layoutManager.primaryMonitor.width / 70) * this._applet.thumbSize) + 16;
        let ThumbnailHeight = Math.floor((Main.layoutManager.primaryMonitor.height / 70) * this._applet.thumbSize) + 16;
		let moniterSize, thumbnailSize;
			if(this._applet.settings.getValue("vertical-thumbnails")){
				moniterSize = Main.layoutManager.primaryMonitor.height;
				thumbnailSize = ThumbnailHeight;
			}else{
				moniterSize = Main.layoutManager.primaryMonitor.width;
				thumbnailSize = ThumbnailWidth;
			}
		if ((thumbnailSize * windows.length) + thumbnailSize >= moniterSize && this._applet.settings.getValue("stack-thumbnails")) {
			this.thumbnailsSpace = Math.floor((moniterSize - 100) / thumbnailSize);
			let firstLoop = this.thumbnailsSpace;
			let nextLoop = firstLoop + this.thumbnailsSpace;
    		if(windows.length < firstLoop)
				firstLoop = windows.length;
			this.addWindowsLoop(0,firstLoop,this.appContainer,windows,1);
			if(windows.length > nextLoop){
				this.addWindowsLoop(firstLoop,nextLoop,this.appContainer2,windows,2);
			}else if(windows.length > firstLoop)
				this.addWindowsLoop(firstLoop,windows.length,this.appContainer2,windows,2);
			if(windows.length > nextLoop)
				this.addWindowsLoop(nextLoop,windows.length,this.appContainer3,windows,3);			
		} else {
			this.addWindowsLoop(0,windows.length,this.appContainer,windows,1);
		}
	},
	
	addWindowsLoop: function(i, winLength, actor, windows,containerNum) {
		for(let i = 0; i < winLength; i++) {
			let metaWindow = windows[i];
			if (this.appThumbnails[metaWindow]) {
	            this.appThumbnails[metaWindow].thumbnail._isFavorite(this.isFavapp);
	        } else {
	            let thumbnail = new WindowThumbnail(this, metaWindow);
	            this.appThumbnails[metaWindow] = {
	                metaWindow: metaWindow,
	                thumbnail: thumbnail,
					cont: containerNum
	            };
	        	actor.add_actor(this.appThumbnails[metaWindow].thumbnail.actor);
	        }
		}
		actor.show();
	},

	setThumbnailIconSize: function(windows) {
		    if (this.isFavapp) {
				this.metaWindowThumbnail.thumbnailIconSize();
				return;
			}
			let winLength = windows.length;
			for(let i in this.appThumbnails) {
				if (this.appThumbnails[i].thumbnail) {
			        this.appThumbnails[i].thumbnail.thumbnailIconSize();
				}
			}
	},

	removeOldWindows: function(windows) {
		for (let win in this.appThumbnails) {
            if (windows.indexOf(this.appThumbnails[win].metaWindow) == -1) {
				if(this.appThumbnails[win].cont == 1){
		            this.appContainer.remove_actor(this.appThumbnails[win].thumbnail.actor);
				}else if(this.appThumbnails[win].cont == 2){
		            this.appContainer2.remove_actor(this.appThumbnails[win].thumbnail.actor);
				}else if(this.appThumbnails[win].cont == 3){
		            this.appContainer3.remove_actor(this.appThumbnails[win].thumbnail.actor);
				}
	            this.appThumbnails[win].thumbnail.destroy();
	            delete this.appThumbnails[win];
            }
        }
	},

	refreshRows: function() {
		let appContLength = this.appContainer.get_children().length;
		let appContLength2 = this.appContainer2.get_children().length;
		if(appContLength < 1){
			this._parentContainer.shouldOpen = false;
		    this._parentContainer.shouldClose = true;
			this._parentContainer.hoverClose();
		}

		if(appContLength < this.thumbnailsSpace && appContLength2 > 0){
			let children = this.appContainer2.get_children();
			let thumbsToMove = (this.thumbnailsSpace - appContLength)
			for(let i = 0; i < thumbsToMove; i++) {
				let actor = children[i]? children[i] : null;
				if(actor == null)
					break;
				this.appContainer2.remove_actor(actor);
				this.appContainer.add_actor(actor);
				this.appThumbnails[actor._delegate.metaWindow].cont = 1;
			}
		}

		appContLength2 = this.appContainer2.get_children().length;
		let appContLength3 = this.appContainer3.get_children().length;

		if(appContLength2 <= 0)
			this.appContainer2.hide();

		if(appContLength2 < this.thumbnailsSpace && appContLength3 > 0){
			let children = this.appContainer3.get_children();
			let thumbsToMove = (this.thumbnailsSpace - appContLength2)
			for(let i = 0; i < thumbsToMove; i++) {
				let actor = children[i]? children[i] : null;
				if(actor == null)
					break;
				this.appContainer3.remove_actor(actor);
				this.appContainer2.add_actor(actor);
				this.appThumbnails[actor._delegate.metaWindow].cont = 2;
			}
		}

		if(this.appContainer3.get_children().length <= 0)
			this.appContainer3.hide();
	}
};

function WindowThumbnail() {
    this._init.apply(this, arguments);
}

WindowThumbnail.prototype = {

    _init: function (parent, metaWindow) {
    	this._applet = parent._applet;
        this.metaWindow = metaWindow || null;
        this.app = parent.app;
        this.isFavapp = parent.isFavapp || false;
        this.wasMinimized = false;
		this._parent = parent;
		this._parentContainer = parent._parentContainer

        // Inherit the theme from the alt-tab menu
        this.actor = new St.BoxLayout({
            style_class: 'item-box',
            reactive: true,
            track_hover: true,
            vertical: true
        });
		this.actor._delegate = this;
		// Override with own theme.
		this.actor.add_style_class_name('thumbnail-box');
        this.thumbnailActor = new St.Bin();

        this._container = new St.BoxLayout({		
			style_class: 'thumbnail-iconlabel-cont',
        });

        let bin = new St.BoxLayout({
			style_class: 'thumbnail-label-bin'
        });

        this.icon = this.app.create_icon_texture(32);
		this.themeIcon = new St.BoxLayout({style_class: 'thumbnail-icon'})
		this.themeIcon.add_actor(this.icon);
		this._container.add_actor(this.themeIcon);
        this._label = new St.Label(
		{style_class: 'thumbnail-label'});
        this._container.add_actor(this._label);
        this.button = new St.BoxLayout({
            style_class: 'thumbnail-close',
            reactive: true
        });
        //this._container.add_actor(this.button);
        this.button.hide();
		bin.add_actor(this._container);
		bin.add_actor(this.button);
        this.actor.add_actor(bin);
        this.actor.add_actor(this.thumbnailActor);

        if (this.isFavapp) this._isFavorite(true);
        else this._isFavorite(false);

        if (this.metaWindow) this.metaWindow.connect('notify::title', Lang.bind(this, function () {
            this._label.text = this.metaWindow.get_title();
        }));
        this.actor.connect('enter-event', Lang.bind(this, function () {
            if (!this.isFavapp) {
				let parent = this._parent._parentContainer;
				parent.shouldOpen = true;
				parent.shouldClose = false;
                this._hoverPeek(this._applet.peekOpacity, this.metaWindow);
                this.actor.add_style_pseudo_class('outlined');
                this.actor.add_style_pseudo_class('selected');
				if(this._applet.showThumbs)
                	this.button.show();
		        if (this.metaWindow.minimized && this._applet.enablePeek) {
		            this.metaWindow.unminimize();
		            this.wasMinimized = true;
		        } else this.wasMinimized = false;
            }
        }));
        this.actor.connect('leave-event', Lang.bind(this, function () {
            if (!this.isFavapp) {
                this._hoverPeek(OPACITY_OPAQUE, this.metaWindow);
                this.actor.remove_style_pseudo_class('outlined');
                this.actor.remove_style_pseudo_class('selected');
                this.button.hide();
		        if (this.wasMinimized) {
		            this.metaWindow.minimize(global.get_current_time());
		        }

            }
        }));
        this.button.connect('button-release-event', Lang.bind(this, this._onButtonRelease));

        this.actor.connect('button-release-event', Lang.bind(this, this._connectToWindow));
    },

    _isFavorite: function (isFav) {
        // Whether we create a favorite tooltip or a window thumbnail
        if (isFav) {
            //this.thumbnailActor.height = 0;
            //this.thumbnailActor.width = 0;
            this.thumbnailActor.child = null;
            let apptext = this.app.get_name();
            // not sure why it's 7
            this.ThumbnailWidth = THUMBNAIL_ICON_SIZE + Math.floor(apptext.length * 7.0);
            this._label.text = apptext;
            this.isFavapp = true;
			this.actor.style = "border-width:2px;padding: 0px;";
			this._container.style = "width: " + this.ThumbnailWidth + "px";
        } else {
			this._refresh();
			this.actor.style = "border-width:2px;padding: 6px;";
		}
    },

    destroy: function () {
		delete this._parent.appThumbnails[this.metaWindow];
		this.actor.destroy_children();
        this.actor.destroy();
    },

    needs_refresh: function () {
        return Boolean(this.thumbnail);
    },

    thumbnailIconSize: function () {
		try{
			let width = this.themeIcon.width;
			let height = this.themeIcon.heigth;
			this.icon.set_size(width,height);
		}catch(e){};
    },

    _getThumbnail: function () {
        // Create our own thumbnail if it doesn't exist
        let thumbnail = null;
        let muffinWindow = this.metaWindow.get_compositor_private();
        if (muffinWindow) {
            let windowTexture = muffinWindow.get_texture();
            let[width, height] = windowTexture.get_size();
            let scale = Math.min(1.0, this.ThumbnailWidth / width, this.ThumbnailHeight / height);
            thumbnail = new Clutter.Clone({
                source: windowTexture,
                reactive: true,
                width: width * scale,
                height: height * scale
            });
        }

        return thumbnail;
    },

    _onButtonRelease: function (actor, event) {
        if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK && actor == this.button) {
			this.destroy();
        	this.stopClick = true;
            this._hoverPeek(OPACITY_OPAQUE, this.metaWindow);
		    this._parentContainer.shouldOpen = false;
		    this._parentContainer.shouldClose = true;
		    Mainloop.timeout_add(2000, Lang.bind(this._parentContainer, this._parentContainer.hoverClose));
            this.metaWindow.delete(global.get_current_time());
			this._parent.refreshRows();
        }
    },

    _connectToWindow: function (actor, event) {
        this.wasMinimized = false;
        if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK && !this.stopClick && !this.isFavapp) {
            this.metaWindow.activate(global.get_current_time());
			let parent = this._parent._parentContainer;
		    parent.shouldOpen = false;
		    parent.shouldClose = true;
		    Mainloop.timeout_add(parent.hoverTime, Lang.bind(parent, parent.hoverClose));
        }else if (event.get_state() & Clutter.ModifierType.BUTTON2_MASK && !this.stopClick) {
			this.destroy();
            this.metaWindow.delete(global.get_current_time());
		}
        this.stopClick = false;
    },

    _refresh: function () {
        // Turn favorite tooltip into a normal thumbnail
        this.ThumbnailHeight = Math.floor(Main.layoutManager.primaryMonitor.height / 70) * this._applet.thumbSize;
        this.ThumbnailWidth = Math.floor(Main.layoutManager.primaryMonitor.width / 70) * this._applet.thumbSize;
        //this.thumbnailActor.height = this.ThumbnailHeight;
        //this.thumbnailActor.width = this.ThumbnailWidth;
		this._container.style = "width: " + Math.floor(this.ThumbnailWidth - 20) + "px";
        this.isFavapp = false;

        // Replace the old thumbnail
		let title = this.metaWindow.get_title();
        this._label.text = title;
		if (this._applet.showThumbs){
		    this.thumbnail = this._getThumbnail();
        	this.thumbnail.height = this.ThumbnailHeight;
        	this.thumbnail.width = this.ThumbnailWidth;
		    this.thumbnailActor.child = this.thumbnail;
		} else {
			this.thumbnailActor.child = null;
		}
    },

    _hoverPeek: function (opacity, metaWin) {
    	let applet = this._applet;
        if (!applet.enablePeek) return;

        function setOpacity(window_actor, target_opacity) {
            Tweener.addTween(window_actor, {
                time: applet.peekTime * 0.001,
                transition: 'easeOutQuad',
                opacity: target_opacity,
            });
        }

        let above_current = [];

        global.get_window_actors().forEach(function (wa) {
            var meta_win = wa.get_meta_window();
            if (metaWin == meta_win) return;

            if (meta_win.get_window_type() != Meta.WindowType.DESKTOP) setOpacity(wa, opacity);


        });
    }
};
