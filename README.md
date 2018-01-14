# MyWord
### *Markup, your way.*

MyWord is a light-weight markup language focused on publishing content on the Web. The main distinguishing characteristic between MyWord and other markup languages (e.g., the many Markdown variants) is the ability for the user to easily define his own custom markup notations to match the needs of the document content. MyWord provides a default *lingo* (a set of notations) which can be used by anyone with some familiarity with Markdown, but these can be augmented by defining new notations or changed by overridingthe defintions of existing notations.

MyWord documents are modular, i.e., they can be broken down into smaller pieces and stored in separate files. And the separate pieces need not be MyWord, they can be Markdown, or programming language source files, even HTML fragments, as long as the *lingo* provides a translator for the content type. Common *lingos* can be packaged as separate files that can be shared among a family of documents.

Like other light-weight markup languages (and, most people would say, unlike HTML) MyWord documents are readable as plain text, but are intended to be rendered by a Web browser. Rendering is performed by a MyWord translator which is loaded along with a MyWord document and runs in the browser. There is no separate compile/export step required for publishing content on a Web server; just save any source changes and they are immediately reflected in any subsequent requests to the server.

For an a more detailed look at MyWord see [Introduction to MyWord](http://ridgeworks.github.io/MyWord/myword-intro.html). Other documentation can also be found at the [MyWord Project Site](http://ridgeworks.github.io/MyWord).

Note that [MyWord Editor](https://github.com/scripting/myWordEditor), a blogging tool, is not related to the MyWord markup language as described in this project.


### How It Works

Authors write MyWord content in their favourite text editor just like other light-weight markup languages, e.g., MarkDown. However, the 'publishing' step is different. Rather than translating the source document to an HTML file using a separate tool, MyWord is translated in the browser environment so, operationally, MyWord is more like MathJax than MarkDown. A simple HTML host file is constructed to reference the MyWord source document and the MyWord translator. Once this is done, the document can be updated just by editing the source file.

The HTML host file links to the translation software using a standard script element in the document head:

>    `<script src=`*`path_to_lib`*`/x-markup.js></script>`

where *`path_to_lib/`* points to a directory containing the contents of the `lib/` directory in this project.

References to MyWord content are placed in the host HTML file using a script element with the custom type attribute `text/x-markup.myword`, so a complete host HTML file for `SimpleExample.myw` would be:

    <!DOCTYPE HTML>
    <html>
    <head>
        <meta lang=en charset="UTF-8">
        <script src='lib/x-markup.js'></script>
    <body>
    <div class=x-markup src="SimpleExample.myw"></div>
    </body>
    </html>

When the MyWord translator is loaded, it scans the document for any `div.x-markup` elements and replaces their contents (normally empty) with the translated contents of the `src` URL.


### Browser Requirements

The translation of MyWord content takes place in the browser, which imposes some minimal constraints. Since the translation step is performed in a separate browser thread to ensure the main page responsiveness is unaffected, the browser must support Web Workers as defined in the HTML5 standard. Most browsers released since .ca 2014 (e.g., Chrome 30.0, Firefox 30.0, Safari 8) provide this support.

In some situations, translation can generate HTML5 scoped style elements. For browsers which do not support this feature, a 'polyfill' is built-in to the post translation phase.


### Getting Started

Download the zip file for this project (`MyWord-master.zip`) and unzip it to produce the folder `MyWord-master` (should be a copy of the MyWord folder shown above). There are two main directories:
- `lib/`, which contains the translation software needed to publish MyWord pages,
- `pkgs/`, contains a suite of packages providing useful notation defintions beyond the basic default lingo. a suggested location for optional user and third party definition packages (`metamark` files), and

`lib/` contains:
- `x-markup.js` - MyWord driver for rendering content as directed by host web page
- `x-markup.mmk` - default lingo file (see [Guide](http://ridgeworks.github.io/MyWord/MyWordGuide.html) for details)
- `markit.js` - the core framework which executes in a Web Worker to translate MyWord content
- `grit.js` - support library for Grit grammars, used to implement MyWord type transforms
- `commonmark.min.js` - reference JavaScript implementation for CommonMark (see the [Guide](http://ridgeworks.github.io/MyWord/MyWordGuide.html) for more information.)

The `lib/` directory is typically, but not necessarily, co-located with document `myword` and `html` files (e.g., `SimpleExample.html` and `SimpleExample.myw`).

Useful, but optional, "features" are provided in packages that can be selectively added to MyWord content. User documentation for these packages is part of the package source files, and additional information can also be found in the [Guide](http://ridgeworks.github.io/MyWord/MyWordGuide.html).

`pkgs/` contains:
 - `tsv.mmk` - support for simple tables using the "tab separated values" data format
 - `asciimath.mmk` - defines an [AsciiMath](http://asciimath.org) to MathML (part of the HTML5 standard) transform function and two pre-defined labels for use.
 - `box.mmk` - simple boxes and arrows diagrams using extended Unicode character set
 - `critic.mmk` - use [Critic Markup](http://criticmarkup.com) notations for tracking changes MyWord content
 - `toc.mmk` - add Tables of Contents to MyWord documents
 - `demo.mmk` - useful example and demo notaions for use in technical documents. Includes interactive demos for use in tutorials.


#### Note for Mac OS X/Safari users
Rendering downloaded MyWord documents locally (i.e., using the `file://` protocol) on Safari may generate a security exception due the quarantining philosophy of OS X. To workaround this problem the `apple.com.quarantine` extended attribute on files must be removed using the Terminal application:
1. Set working directory to the download.
2. To see if the quarantine attribute is set: `ls -@l`
3. To remove the quarantine bit on all files and sub-directories: `xattr -d -r com.apple.quarantine *`

