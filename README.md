# MyWord
### *Markup, your way.*

This project is **under construction**. Feel free to look around, but more to come.

The essence of any markup language is to enable an author to label pieces of text to enhance their presentation or convey special meaning. In MyWord the authors can define their own markup labels and embed any kind of markup language or notation.

MyWord enables the first word in a line to be used as a markup label for a block of text. Inside different blocks of text different notations and markup languages can be used. Blocks of text without a markup label are paragraphs of prose by default. Within prose paragraphs, markup labels can be applied to text in brackets.

For an in-depth look at MyWord see [Introduction to MyWord](http://ridgeworks.github.io/MyWord/MyWord.html). Other documentation can also be found at [MyWord Project](http://ridgeworks.github.io/MyWord).


### How It Works

Authors write MyWord content in their favourite text editor just like other light-weight markup languages, e.g., MarkDown. However, the 'publishing' step is different. Rather than translating the source document to an HTML file using a separate tool, MyWord is translated in the browser environment; operationally, MyWord is more like [MathJax](https://www.mathjax.org) than [MarkDown](https://daringfireball.net/projects/markdown/). A simple HTML host file is constructed to reference the MyWord source document and the MyWord translator. Once this is done, the document can be updated just by replacing the source file.

The HTML host file links to the translation software using a standard script element in the document head:

>    `<script src=`*`path_to_lib`*`/x-markup.js></script>`

where *`path_to_lib/`* points to a directory containing the contents of the `lib/` directory in this project.

References to MyWord content are placed in the host HTML file using a script element with the custom type attribute `text/x-markup.myword`, so a complete host HTML file for `myDoc.myw` would be:

    <!DOCTYPE HTML>
    <html>
    <head>
        <meta lang=en charset="UTF-8">
        <title>MyDoc</title>
        <script src='lib/x-markup.js'></script>
    <body>
    <script type=text/x-markup.myword src="myDoc.myw"></script>
    </body>
    </html>

For small amounts of content, the source text can be placed inside the script element:

    <script type=text/x-markup.myword>
    :h2  A Header Line

    The :cite[Alice In Wonderland] story.
    </script>

In either case, translation results in the script element being replaced by a div element containing the translated contents.

A useful set of label definitions is provided in `lib/x-markup.mmk`, but users are free to add, modify, or override these definitions. (See [Reference](http://ridgeworks.github.io/MyWord).)


### Browser Requirements

The translation of MyWord content takes place in the browser, which imposes some minimal constraints. Since the translation step is performed in a separate browser thread to ensure the main page responsiveness is unaffected, the browser must support Web Workers as defined in the HTML5 standard. Most browsers released since .ca 2014 (e.g., Chrome 30.0, Firefox 30.0, Safari 8) provide this support.

In some situations, translation can generate HTML5 scoped style elements. For browsers which do not support this feature, a 'polyfill' is built-in to the post translation phase.

(Note: Since users can provide their own label definitions through JavaScript, care must be taken to avoid language/API features which inadvertently prevent content from being translated on targeted browsers.)