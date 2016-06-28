# MyWord
### *Markup, your way.*

The essence of any markup language is to enable an author to label pieces of text to enhance their presentation or convey special meaning. In MyWord the authors can define their own markup labels and embed any kind of markup language or notation.

MyWord enables the first word in a line to be used as a markup label for a block of text. Inside different blocks of text different notations and markup languages can be used. Blocks of text without a markup label are paragraphs of prose by default. Within prose paragraphs, markup labels can be applied to text in brackets.

For an in-depth look at MyWord see [Introduction to MyWord](http://ridgeworks.github.io/MyWord/MyWord.html). Other documentation can also be found at the [MyWord Project Site](http://ridgeworks.github.io/MyWord).

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
    <script type=text/x-markup.myword src="SimpleExample.myw"></script>
    </body>
    </html>

For small amounts of content, the source text can be placed inside the script element:

    <script type=text/x-markup.myword>
    ###  Simple MyWord Document

    :b(Hello World!) Replace this with your content.
    </script>

In either case, translation results in the script element being replaced by a div element containing the translated contents.


### Browser Requirements

The translation of MyWord content takes place in the browser, which imposes some minimal constraints. Since the translation step is performed in a separate browser thread to ensure the main page responsiveness is unaffected, the browser must support Web Workers as defined in the HTML5 standard. Most browsers released since .ca 2014 (e.g., Chrome 30.0, Firefox 30.0, Safari 8) provide this support.

In some situations, translation can generate HTML5 scoped style elements. For browsers which do not support this feature, a 'polyfill' is built-in to the post translation phase.


### Getting Started

Download the zip file for this project (`MyWord-master.zip`) and unzip it to produce the folder `MyWord-master` (should be a copy of the MyWord folder shown above). There are three main directories:
- `lib/`, which contains the translation software needed to publish MyWord pages,
- `pkgs/`, a suggested location for optional user and third party definition packages (`metamark` files), and
- `tools/`, containing some pre-built web pages which may be of use for authoring MyWord documents.
These are discussed in more detail below.

`lib/` contains:
- `x-markup.js` - MyWord driver for rendering content as directed by host web page
- `x-markup.mmk` - default lingo file (see [MyWord Lingo](http://ridgeworks.github.io/MyWord/MyWordLingo.html)), default definitions can be overriden by the author
- `x-markup.css` - default css as required by the default lingo
- `markit.js` - a markup frameword containing the core `myword`, `prose`, and `metamark` transforms
- `grit.js` - support library for Grit grammars

The `lib/` directory is typically, but not necessarily, co-located with document `myword` and `html` files (e.g., `SimpleExample.html` and `SimpleExample.myw`).

`pkgs/` contains:
 - `asciimath.mmk` - defines an [AsciiMath](http://asciimath.org) to MathML (part of the HTML5 standard) transform function and two pre-defined labels for use. (Additional information on using math in MyWord documents can be found here [Markup for Mathematics](http://ridgeworks.github.io/MyWord/MyWord_Note_MathMarkup.html).) This directory is also a convenient place for keeping `metamark` packages based on third party software [Using External Transform Functions](http://ridgeworks.github.io/MyWord/MyWord_Note_ExternalTransforms.html).

`tools/` contains:
- `MyWordReader.html` - this web page can be used to select and render MyWord files located in the same directory, so that a document specific HTML host is not required. Load the page and use the 'Choose File' button to select a MyWord file.
- `_myw_template.html` - simple html host files can be created by taking a copy of this file and renaming it after the MyWord source file, e.g., for `MyDoc.myw`, name the template copy `MyDoc.html`. (Both files must be in the same directory.)


#### Note for Mac OS X/Safari users
Rendering downloaded MyWord documents locally (i.e., using the `file://` protocol) on Safari may generate a security exception due the quarantining philosophy of OS X. To workaround this problem the `apple.com.quarantine` extended attribute on files must be removed using the Terminal application:
1. Set working directory to the download.
2. To see if the quarantine attribute is set: `ls -@l`
3. To remove the quarantine bit on all files and sub-directories: `xattr -d -r com.apple.quarantine *`




