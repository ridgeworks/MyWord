@doc
	***** Default Lingo *****
	Type definitions required for basic HTML generation

text        :: (content) => content.replace(/&/g,'&amp;').replace(/</g,'&lt;')

ctrl        :: (ctl) => {
	             switch (ctl) {
	               case '\n' : return '<span class=newline>\n</span>'
	               case '\t' : return '<span class=tab>\t</span>'
	               default   : return '<span class=my_ctl data-code=\''+ctl.charCodeAt(0).toString()+'\'>\ufffd</span>'
	             }
	           }

paragraph   :: (content) => `<p class=my_p>${markit('prose', content)}</p>`

blankline   :: (_) => '<div class=my_blank>&nbsp;</div>'

insetblock  :: (content) => `<div class=my_insetblock>${markit('myword',content)}</div>`

scope       :: (content, context) =>
	             (context) ? `<span class=myword data-context=${context}>${content}</span>` : content

markedblock :: (content, label) => ((blkcontent = content.replace(/\n/g, '\n\t')) =>
	             `<pre class=Undefined>${markit('text', label)}\n\t${markit('text', blkcontent)}</pre>`
	           ) ()

errorString :: (content) => {
	             if (console) console.error('markit: ' + content)
	             return `<pre><mark style='color:blue'>*** Error *** ${markit('text', content)}</mark></pre>`
	           }

metajs      :: (javascript) => `<script type=application/javascript>${javascript}</script>`
metacss     :: (css) => `<style scoped>${css}</style>`


@doc
	set default tab size to 4 spaces; inherited by all body content unless overridden
	set newline to be significant, i.e., a line break.
	set default paragraph margin to 0 (overrides user agent spacing).

@css
	body {tab-size:4; -moz-tab-size:4;}
	span.newline {white-space:pre}
	p.my_p {margin:0}


@doc
	Types for treating parmstring in label defintions as the content for symbols
	
	`viz` treats parmstring as `myword`
	`is` treats parmstring as raw text

viz         :: (_, parmstring) => markit('myword', parmstring)
is          :: (_, parmstring) => parmstring


@doc	`&` block notation for `metamark` content (type `metamark` defined in core translator)

& ..        <- metamark


@doc
	`@include` block notation for external content via URL (type `include` defined in core translator)
	`.myw` and `.txt` block notations for file suffixes used with `@include`

@include .. <- include
.myw ..     <- <div class=mywInclude> myword
.txt ..     <- <pre class=txtInclude> text

@css
	pre.txtInclude {margin:0}


@doc	`{ .. }` span notation (with alternative) for labeled inline content

{ .. }      <- inline { }
{( .. )}    <- inline {( )}

inline      :: (content, brackets) => {
	              var parsed = /(\s*)(\S+)\s*([\S\s]*)/.exec(content)	// parsed=[all, leading, label, content]
	              var br = brackets.split(' ')
	              return (!parsed[1] && (markit.applyLabel(parsed[2]+' ..', null) !== null) && parsed[3])
	                ? markit.applyLabel(parsed[2]+' ..', parsed[3])
	                : [br[0], markit('myword', parsed[0]), br[1]].join('')
	            }

@doc
	inline      :~ (\s*)(\S+)\s*([\S\s]*)  :: (all, leading, label, content) =>
					 (!leading && (markit.applyLabel(label+' ..', null) !== null) && content)
					   ? markit.applyLabel(label+' ..', content)
					   : markit('myword', all)


@doc	`[ .. ]` span notation for placeholders (references to label defintions)

[ .. ]      <- asdefined
asdefined   :: (contents) => ((defined = markit.applyLabel('['+contents.trim()+']', contents)) =>
	             defined
	               ? defined
	               : `<span class=Undefined>[${markit('text', contents)}]</span>`
	           ) ()


@doc
	`< .. >` span notation for hyperlinks, content is URL or notation can be literal `myword`
	(Note: `link` type also used in placeholder defintions which supply the URL in the parmstring.)

< .. >      <- link
link        :: (contents, url) =>
	             url
	               ? `<a href='${url}'>${markit('myword',contents)}</a>`
	               : ((/(?:(?:^[a-z](?:[-a-z0-9+.])*:\/\/)|(?:^[\/]?[^\s\/]+[\/.][^\s]+)|(?:#))\S+$/.test(contents.trim()))
	                 ? `<a href='${contents.trim()}'>${contents}</a>`
	                 : ['&lt;', markit('myword', contents), '>'].join('')
	               )


@doc
	`#id ..` block notation for internal link targets, which are hidden by default.
	`id` attribute value is the first word of the content, any remaining content is treated as `myword`.
	

#id ..       <- target
target       :~ (\S+\s*)([\S\s]*) :: (_, id, content) =>
	                   `<span class=target id='${id.trim()}'>${markit('text', id)}</span>${markit('myword', content)}`

@css
	span.target {visibility:hidden; height:1px; width:1px; position:absolute;}


@doc	`image` type for use with placeholders, e.g., `[gopher] <- image images/gopher.png`

image        :: (contents, url) => `<img src='${url?url:contents.trim()}' alt='${markit('text',contents)}'/>`


@doc
	Common Light-weight Markup:
	-  block notations for headers (with id's) and block quote
	-  span notation for escaping inline notations.
	-  span notations for simple markup:`italics`, `bold` (with `alternatives), and `code`.
	-  span notation for typograhical double quotes
	-  symbols for horizontal rule and apostrophe

# ..         <- header 1
## ..        <- header 2
### ..       <- header 3
#### ..      <- header 4
##### ..     <- header 5
###### ..    <- header 6

> ..         <- <blockquote class=my_blockquote>

`` .. ``     <- <span class=my_text> text
``( .. )``   <- <span class=my_text> text

` .. `       <- <code class=my_text> text
`( .. )`     <- <code class=my_text> text

* .. *       <- <i>
*( .. )*     <- <i>

** .. **     <- <b>
**( .. )**   <- <b>

" .. "       <- <q class=my_dquo>
"( .. )"     <- <q class=my_dquo>

---          <- <hr class=my_hr />
'            <- &rsquo;

header       :: (c, level) =>
	              `<h${level} class=my_h${level} id='toc${level}${c.trim().replace(/[^\w$-@.&!*(),]/g, '_')}'>${markit('myword', c)}</h${level}>`

@css
	h1.my_h1, h2.my_h2, h3.my_h3, h4.my_h4, h5.my_h5, h6.my_h6 {margin:0}
	blockquote.my_blockquote {margin:0 40px}
	q.my_dquo {quotes: "\201c" "\201d"}
	.my_text {white-space:pre}
	hr.my_hr + span.newline {display:none}


@doc
	Lists:
	Alternative block notations for list items: `*` or `+` or `-`
	`*..` block notation for unordered list
	Several block notations for ordered list for numbers, letters, roman numerals etc.

* ..         <- <div class=my_listitem>
+ ..         <- <div class=my_listitem>
- ..         <- <div class=my_listitem>
*.. ..       <- <ul class=mywordlist style="list-style-type:disc">
1.. ..       <- orderedlist decimal
01.. ..      <- orderedlist decimal-leading-zero
i.. ..       <- orderedlist lower-roman
I.. ..       <- orderedlist upper-roman
A.. ..       <- orderedlist upper-latin
a.. ..       <- orderedlist lower-latin

orderedlist  :: (content, type) =>
	              `<ol class=my_list style="list-style-type:${type}">${markit('myword',content)}</ol>`

@css
	.my_list {margin:0px}
	.my_list div.my_listitem {margin-left:0px}
	div.my_listitem {display:list-item; margin-left:40px}
