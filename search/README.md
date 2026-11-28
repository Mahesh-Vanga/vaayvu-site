# Browser search data

Vaayvu sends ordinary web searches to the provider selected in Settings. Offline search reads the website and topic directories bundled in `chrome/`. Their source attributions and revision information appear at the top of each generated file.

`site-directory.py` rebuilds the site list from a local Majestic Million CSV. `topic-directory.py` refreshes the topic list from Wikipedia. Neither tool runs while browsing.

The native clients can also use an optional regional endpoint configured before building. `client-deployment.example.json` gives its manifest shape. A local `client-deployment.json` is specific to the operator. The default release uses the bundled directories.
