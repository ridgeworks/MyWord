# MyWord
### *Markup, your way.*

MyWord is a light-weight markup language focused on publishing content on the Web. The main distinguishing characteristic between MyWord and other markup languages (e.g., the many Markdown variants) is the ability for the user to easily define his own custom markup notations to match the needs of the document content. MyWord provides a default *lingo* (a set of notations) which can be used by anyone with some familiarity with Markdown, but these can be augmented by defining new notations or changed by overriding the defintions of existing notations.

MyWord documents are modular, i.e., they can be broken down into smaller pieces and stored in separate files. And the separate pieces need not be MyWord, they can be Markdown, or programming language source files, even HTML fragments, as long as the *lingo* provides a translator for the content type. Common *lingos* can be packaged as separate files that can be shared among a family of documents.

Like other light-weight markup languages (and, most people would say, unlike HTML) MyWord documents are readable as plain text, but are intended to be rendered by a Web browser. Rendering is performed by a MyWord translator which is loaded along with a MyWord document and runs in the browser. There is no separate compile/export step required for publishing content on a Web server; just save any source changes and they are immediately reflected in any subsequent requests to the server.

Detailed MyWord documentation can be found at the [MyWord Project Site](http://ridgeworks.github.io/MyWord). Start with [Introduction to MyWord](http://ridgeworks.github.io/MyWord/myword-intro.html) for basic usage and configuring a local environment for authoring MyWord documents. 

Note that **MyWord Editor**, a blogging tool, is not related to the MyWord markup language as described in this project.


### How It Works

Authors write MyWord content in their favourite text editor just like other light-weight markup languages, e.g., Markdown. However, the 'publishing' step is different. Rather than translating the source document to an HTML file using a separate tool, MyWord is translated in the browser environment so, operationally, MyWord is more like MathJax than Markdown. A simple HTML host file is constructed to reference the MyWord source document and the MyWord translator. Once this is done, the document can be updated just by editing the source file.

The HTML host file links to the translation software using a standard script element in the document head:

>    `<script src=`*`path_to_lib`*`/x-markup.js></script>`

where *`path_to_lib/`* points to a directory containing the contents of the `lib/` directory in this project.

References to MyWord content are placed in the host HTML file using a script element with the custom type attribute `text/x-markup.myword`, so a complete host HTML file for `ReadMe.myw` would be:

    <!DOCTYPE HTML>
    <html>
    <head>
        <meta lang=en charset="UTF-8">
        <script src='lib/x-markup.js'></script>
    <body>
    <div class=x-markup src="ReadMe.myw"></div>
    </body>
    </html>

When the MyWord translator is loaded, it scans the document for any `div.x-markup` elements and replaces their contents (normally empty) with the translated contents of the `src` URL.


### Browser Requirements

The translation of MyWord content takes place in a separate thread in the browser. This ensures the responsiveness of the main page is unaffected by translation but does require the browser to support Web Workers as defined in the HTML5 standard. Most browsers released since .ca 2014 (e.g., Chrome 30.0, Firefox 30.0, Safari 8) provide this support.


### Getting Started

Download the zip file for this project (`MyWord-master.zip`) from the project "releases" tab, and unzip it to produce the folder `MyWord-master` (should be a copy of the MyWord folder shown above). The contents of the `dist/` directory is a "starter kit" for a Web server capable of serving MyWord content to a browser where it can be rendered. The `dist/` directory contains the simple `ReadMe` example shown above and two sub-directories:
- `lib/` - contains the translation software needed to publish MyWord pages,
- `pkgs/` - contains a suite of packages providing some useful notation defintions extending the default lingo defined in `lib/x-markup.mmk`.

`lib/` contains:
- `x-markup.js` - MyWord driver for rendering content as directed by host web page
- `x-markup.mmk` - default lingo file (see [Guide](http://ridgeworks.github.io/MyWord/MyWordGuide.html) for details)
- `markit.js` - the core framework which executes in a Web Worker to translate MyWord content
- `grit.js` - support library for Grit grammars, used to implement MyWord type transforms
- `commonmark.min.js` - reference JavaScript implementation for CommonMark (see the [Guide](http://ridgeworks.github.io/MyWord/MyWordGuide.html) for more information.)

The `lib/` directory is typically, but not necessarily, co-located with document `myword` and `html` files (e.g., `ReadMe` example in the `dist/` directory).

Useful, but optional, "features" are provided in packages. User documentation for these packages is part of the package source files, and additional information can also be found in the [Guide](http://ridgeworks.github.io/MyWord/MyWordGuide.html). Some packages use custom elements, a more recent HTML5 feature, but it is natively supported by many modern browsers. A [polyfill for custom elements](https://github.com/webcomponents/custom-elements) is available when this is not the case, or when older versions of browsers need to be supported. 

`pkgs/` contains:
 - `tsv.mmk` - support for simple tables using the "tab separated values" data format
 - `asciimath.mmk` - defines an [AsciiMath](http://asciimath.org) to MathML (part of the HTML5 standard) transform function and two pre-defined labels for use.
 - `box.mmk` - simple boxes and arrows diagrams using extended Unicode character set.
 - `critic.mmk` - use [Critic Markup](http://criticmarkup.com) notations for tracking changes in MyWord content.
 - `toc.mmk` - add Tables of Contents to MyWord documents.
 - `demo.mmk` - useful example and demo notations for use in technical documents. Includes interactive demos for use in tutorials.

Additional useful packages supporting features like syntax colouring, graphs, and music notations, can be found in the [MyWord-Package-Library](https://github.com/ridgeworks/MyWord-Package-Library). 