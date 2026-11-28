#import <AppKit/AppKit.h>

@interface VaayvuDockTile : NSObject <NSDockTilePlugIn>
@end

@implementation VaayvuDockTile
- (void)setDockTile:(NSDockTile *)tile {
    if (tile == nil) return;

    // This plug-in runs in the Dock's host. Find the image in Vaayvu's bundle.
    NSURL *plugin = [NSBundle bundleForClass:self.class].bundleURL;
    NSURL *contents = plugin.URLByDeletingLastPathComponent.URLByDeletingLastPathComponent;
    NSImage *logo = [[NSImage alloc] initWithContentsOfURL:
        [contents URLByAppendingPathComponent:@"Resources/VaayvuDock.png"]];
    if (logo == nil) return;

    NSImageView *view = [[NSImageView alloc] initWithFrame:(NSRect){NSZeroPoint, tile.size}];
    view.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    view.imageScaling = NSImageScaleProportionallyUpOrDown;
    view.image = logo;
    tile.contentView = view;
    [tile display];
}
@end
