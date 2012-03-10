//vim: expandtab shiftwidth=4 tabstop=8 softtabstop=4 encoding=utf-8 textwidth=99
/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

// Some special subclasses of popupMenu
// such that the menu can be opened via a
// particular button only, or via hovering


const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Cinnamon;
const St = imports.gi.St;

const HOVER_MENU_TIMEOUT = 500;
const THUMBNAIL_DEFAULT_SIZE = Math.max(150, Main.layoutManager.primaryMonitor.width / 10);

function HoverMenuController() {
    this._init.apply(this, arguments);
}

HoverMenuController.prototype = {
    _init: function(actor, menu, params) {
        // reactive: should the menu stay open if your mouse is above the menu
        // clickShouldImpede: if you click actor, should the menu be prevented from opening
        // clickShouldClose: if you click actor, should the menu close
        params = Params.parse(params, { reactive: true,
                                        clickShouldImpede: true,
                                        clickShouldClose: true });

        this._parentActor = actor;
        this._parentMenu = menu;

        this._parentActor.reactive = true;
        this._parentActor.connect('enter-event', Lang.bind(this, this._onEnter));
        this._parentActor.connect('leave-event', Lang.bind(this, this._onLeave));

        // If we're reactive, it means that we can move our mouse to the popup
        // menu and interact with it.  It shouldn't close while we're interacting
        // with it.
        if (params.reactive) {
            this._parentMenu.actor.connect('enter-event', Lang.bind(this, this._onParentMenuEnter));
            this._parentMenu.actor.connect('leave-event', Lang.bind(this, this._onParentMenuLeave));
        }

        if (params.clickShouldImpede || params.clickShouldClose) {
            this.clickShouldImpede = params.clickShouldImpede;
            this.clickShouldClose = params.clickShouldClose;
            this._parentActor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        }
    },

    _onButtonPress: function() {
        if (this.clickShouldImpede) {
            this.shouldOpen = false;
        }
        if (this.clickShouldClose) {
            if (!this.impedeClose) {
                this.shouldClose = true;
            }
            this.close();
        }
    },

    _onParentMenuEnter: function() {
        if (!this.impedeOpen) {
            this.shouldOpen = true;
        }
        this.shouldClose = false;

        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.open));
    },

    _onParentMenuLeave: function() {
        this.shouldClose = true;

        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.close));
    },

    _onEnter: function() {
        if (!this.impedeOpen) {
            this.shouldOpen = true;
        }
        this.shouldClose = false;

        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.open));
    },

    _onLeave: function() {
        if (!this.impedeClose) {
            this.shouldClose = true;
        }
        this.shouldOpen = false;

        Mainloop.timeout_add(HOVER_MENU_TIMEOUT, Lang.bind(this, this.close));
    },

    open: function() {
        if (this.shouldOpen && !this._parentMenu.isOpen) {
            this._parentMenu.open(true);
        }
    },

    close: function() {
        if (this.shouldClose) {
            this._parentMenu.close(true);
        }
    },

    enable: function() {
        this.impedeOpen = false;
    },

    disable: function() {
        this.impedeOpen = true;
    }
};

function HoverMenu() {
    this._init.apply(this, arguments);
}

HoverMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(actor, params) {
        if (Main.desktop_layout == Main.LAYOUT_FLIPPED)
            PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.0, St.Side.TOP, 0);
        else
            PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.0, St.Side.BOTTOM, 0); 

        params = Params.parse(params, { reactive: true });

        this._parentActor = actor;

        this.actor.hide();

        if (params.reactive) {
            Main.layoutManager.addChrome(this.actor);
        } else {
            Main.uiGroup.add_actor(this.actor);
        }
    }
};

function AppThumbnailHoverMenu() {
    this._init.apply(this, arguments);
}

AppThumbnailHoverMenu.prototype = {
    __proto__: HoverMenu.prototype,

    _init: function(actor, metaWindow, app) {
        HoverMenu.prototype._init.call(this, actor, { reactive: true });

        this.metaWindow = metaWindow;
        this.app = app;

        this.appSwitcherItem = new PopupMenuAppSwitcherItem(this.metaWindow, this.app);
        this.addMenuItem(this.appSwitcherItem);
    },

    open: function(animate) {
        // Refresh all the thumbnails, etc when the menu opens.  These cannot
        // be created when the menu is initalized because a lot of the clutter window surfaces
        // have not been created yet...
        this.appSwitcherItem._refresh();
        PopupMenu.PopupMenu.prototype.open.call(this, animate);
    },

    setMetaWindow: function(metaWindow) {
        this.metaWindow = metaWindow;
        this.appSwitcherItem.setMetaWindow(metaWindow);
    }
}


function PopupMenuThumbnailItem() {
    this._init.apply(this, arguments);
}

PopupMenuThumbnailItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (image, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.image = image;
        this.addActor(this.image);
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
        params = Params.parse(params, { hover: false });
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.metaWindow = metaWindow;
        this.app = app;

        this.appContainer = new St.BoxLayout({ style_class: 'app-window-switcher',
                                               reactive: true,
                                               track_hover: true,
                                               can_focus: true,
                                               vertical: false });

        this.appThumbnails = {};
        this.divider = new St.Bin({ style_class: 'app-window-switcher-divider',
                                    y_fill: true });
        this.appContainer.add_actor(this.divider);
        this._refresh();

        this.addActor(this.appContainer);
    },

    setMetaWindow: function(metaWindow) {
        this.metaWindow = metaWindow;
    },

    _connectToWindowOpen: function(actor, metaWindow) {
        actor._button_release_signal_id = actor.connect('button-release-event', Lang.bind(this, function() {
            metaWindow.activate(global.get_current_time());
        }));
    },

    _refresh: function() {
        // Check to see if this.metaWindow has changed.  If so, we need to recreate
        // our thumbnail, etc.
        if (this.metaWindowThumbnail && this.metaWindowThumbnail.metaWindow == this.metaWindow) {
            this.metaWindowThumbnail._refresh();
        } else {
            if (this.metaWindowThumbnail) {
                this.metaWindowThumbnail.actor.disconnect(this.metaWindowThumbnail.actor._button_release_signal_id);
                this.metaWindowThumbnail.destroy();
            }
            // If our metaWindow is null, just move along
            if (this.metaWindow) {
                this.metaWindowThumbnail = new WindowThumbnail(this.metaWindow, this.app);
                this._connectToWindowOpen(this.metaWindowThumbnail.actor, this.metaWindow);
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
            } /*else {
                let thumbnail = new WindowThumbnail(metaWindow, this.app);
                this.appThumbnails[metaWindow] = { metaWindow: metaWindow,
                                                   thumbnail: thumbnail };
                this.appContainer.add_actor(this.appThumbnails[metaWindow].thumbnail.actor);
                this._connectToWindowOpen(this.appThumbnails[metaWindow].thumbnail.actor, metaWindow);
            }*/
        }));

        // Update appThumbnails to remove old programs
        for (let win in this.appThumbnails) {
            if (windows.indexOf(this.appThumbnails[win].metaWindow) == -1) {
                this.appContainer.remove_actor(this.appThumbnails[win].thumbnail.actor);
                this.appThumbnails[win].thumbnail.destroy();
                delete this.appThumbnails[win];
            }
        }

        // Show the divider if there is more than one window belonging to this app
      /*  if (Object.keys(this.appThumbnails).length > 0) {
            this.divider.show();
        }*/// else {
            this.divider.hide();
        //}
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
        this.actor = new St.BoxLayout({ style_class: 'window-thumbnail',
                                        reactive: true,
                                        can_focus: true,
                                        vertical: true });
        this.thumbnailActor = new St.Bin({ y_fill: false,
                                           y_align: St.Align.MIDDLE });
        this.thumbnailActor.height = THUMBNAIL_DEFAULT_SIZE;
        this.titleActor = new St.Label();
        //TODO: should probably do this in a smarter way in the get_size_request event or something...
        //fixing this should also allow the text to be centered
        this.titleActor.width = THUMBNAIL_DEFAULT_SIZE;

        this.actor.add(this.titleActor);
        this.actor.add(this.thumbnailActor);
        this._refresh();

        // the thumbnail actor will automatically reflect changes in the window
        // (since it is a clone), but we need to update the title when it changes
        this.metaWindow.connect('notify::title', Lang.bind(this, function(){
                                                    this.titleActor.text = this.metaWindow.get_title();
                                }));
        this.actor.connect('enter-event', Lang.bind(this, function() {
                                                        this.actor.add_style_pseudo_class('hover');
                                                        this.actor.add_style_pseudo_class('selected');
                                                    }));
        this.actor.connect('leave-event', Lang.bind(this, function() {
                                                        this.actor.remove_style_pseudo_class('hover');
                                                        this.actor.remove_style_pseudo_class('selected');
                                                    }));
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
            let scale = Math.min(1.0, THUMBNAIL_DEFAULT_SIZE / width, THUMBNAIL_DEFAULT_SIZE / height);
            thumbnail = new Clutter.Clone ({ source: windowTexture,
                                             reactive: true,
                                             width: width * scale,
                                             height: height * scale });
        }

        return thumbnail;
    },

    _refresh: function() {
        // Replace the old thumbnail
        this.thumbnail = this._getThumbnail();

        this.thumbnailActor.child = this.thumbnail;
        this.titleActor.text = this.metaWindow.get_title();
    }
};

function AppMenuButtonRightClickMenu(actor, app, metaWindow) {
    this._init(actor, app, metaWindow);
}

AppMenuButtonRightClickMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(actor, app, metaWindow) {
        //take care of menu initialization
    if (Main.desktop_layout == Main.LAYOUT_FLIPPED)
            PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.0, St.Side.TOP, 0);
        else
            PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.0, St.Side.BOTTOM, 0); 
        Main.uiGroup.add_actor(this.actor);
        //Main.chrome.addActor(this.actor, { visibleInOverview: true,
        //                                   affectsStruts: false });
        this.actor.hide();
        actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
//        this.connect('open-state-changed', Lang.bind(this, this._onToggled));

        this.metaWindow = metaWindow;
        this.app = app;
	
        this.itemCloseWindow = new PopupMenu.PopupMenuItem('Close');
        this.itemCloseWindow.connect('activate', Lang.bind(this, this._onCloseWindowActivate));        
        if (metaWindow.minimized)
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem('Restore');
        else
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem('Minimize');
        this.itemMinimizeWindow.connect('activate', Lang.bind(this, this._onMinimizeWindowActivate));        
        if (metaWindow.get_maximized())
            this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_("Unmaximize"));
        else
            this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_('Maximize'));
        this.itemMaximizeWindow.connect('activate', Lang.bind(this, this._onMaximizeWindowActivate));        
        
        if (this.orientation == St.Side.BOTTOM) {
            this.addMenuItem(this.itemMinimizeWindow);
            this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemCloseWindow);                        
        }
        else {
            this.addMenuItem(this.itemCloseWindow);
            this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemMinimizeWindow);
        }
      //} 
    },

/*    _onToggled: function(actor, state){        
        if (state) {
            if (this.windowList.actor != null) {
                let coord = this.mouseEvent.get_coords();
                let panelOffset = this.windowList.actor.get_geometry().x
                let buttonOffset = actor.sourceActor.get_geometry().x;
                let buttonWidth = (actor.sourceActor.get_geometry().width / 2);
                
                this.actor.set_position((0 - buttonOffset - buttonWidth - panelOffset) + coord[0], 0);
            }
        }
    },*/
    
    _onWindowMinimized: function(actor, event){
    },

    _onCloseWindowActivate: function(actor, event){
        this.metaWindow.delete(global.get_current_time());
    },

    _onMinimizeWindowActivate: function(actor, event){
        if (this.metaWindow.minimized)
            this.metaWindow.unminimize(global.get_current_time());
        else
            this.metaWindow.minimize(global.get_current_time());
    },

    _onMaximizeWindowActivate: function(actor, event){      
        // 3 = 1 | 2 for both horizontally and vertically (didn't find where the META_MAXIMIZE_HORIZONTAL and META_MAXIMIZE_VERTICAL constants were defined for the JS wrappers)
        if (this.metaWindow.get_maximized()){
            this.metaWindow.unmaximize(3);
            this.itemMaximizeWindow.label.set_text(_("Maximize"));
        }else{
            this.metaWindow.maximize(3);
            this.itemMaximizeWindow.label.set_text(_("Unmaximize"));
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

    }

};
