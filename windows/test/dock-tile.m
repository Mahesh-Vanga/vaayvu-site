#import <AppKit/AppKit.h>

// Run against the plug-in inside the signed app, including its resource lookup.
int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 3) return 1;
        NSBundle *bundle = [NSBundle bundleWithPath:@(argv[1])];
        Class principal = bundle.principalClass;
        if (![principal conformsToProtocol:@protocol(NSDockTilePlugIn)]) return 2;
        id<NSDockTilePlugIn> plugin = [[principal alloc] init];
        [NSApplication.sharedApplication setActivationPolicy:NSApplicationActivationPolicyAccessory];
        NSDockTile *tile = NSApp.dockTile;
        [plugin setDockTile:tile];
        NSImageView *view = (NSImageView *)tile.contentView;
        if (![view isKindOfClass:NSImageView.class] || !view.image || view.isOpaque) return 3;
        if (view.imageScaling != NSImageScaleProportionallyUpOrDown) return 4;

        view.frame = NSMakeRect(0, 0, 128, 128);
        NSBitmapImageRep *bitmap = [view bitmapImageRepForCachingDisplayInRect:view.bounds];
        if (!bitmap) return 5;
        [view cacheDisplayInRect:view.bounds toBitmapImageRep:bitmap];
        for (NSNumber *x in @[@0.02, @0.98]) {
            NSInteger px = x.doubleValue * (bitmap.pixelsWide - 1);
            if ([bitmap colorAtX:px y:bitmap.pixelsHigh / 2].alphaComponent < 0.95) return 6;
            for (NSNumber *y in @[@0.01, @0.99]) {
                NSInteger py = y.doubleValue * (bitmap.pixelsHigh - 1);
                if ([bitmap colorAtX:px y:py].alphaComponent > 0.05) return 7;
            }
        }
        NSData *png = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
        if (![png writeToFile:@(argv[2]) atomically:YES]) return 8;
        [plugin setDockTile:nil];
        return 0;
    }
}
