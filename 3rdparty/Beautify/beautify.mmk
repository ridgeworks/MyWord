@import
    beautify.fw.js beautify-css.fw.js beautify-html.fw.js
    highlight.pack.js styles/xcode.min.css

.javascript ..  <- beautifyjs <pre>
beautifyjs      :: (content) => hljs.highlightAuto(js_beautify(content)).value

.stylesheet ..	<- beautifycss <pre>
beautifycss     :: (content) => hljs.highlightAuto(css_beautify(content)).value

.hypertextML .. <- beautifyhtml <pre>
beautifyhtml    :: (content) => hljs.highlightAuto(html_beautify(content)).value
    
highlight       :: (content) => hljs.highlightAuto(content).value 