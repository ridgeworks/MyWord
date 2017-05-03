// Type definitions for basic HTML generation


errorString :: (content) =>	{
                    if (console) console.error('markit: ' + content)
                    return `<pre><mark style='color:blue'>\n*** Error *** ${markit('code', content)}\n</mark></pre>`
                  }

text        :: (content) => content.replace(/</g,'&lt;')
code        :: (content) => content.replace(/&/g,'&amp;').replace(/</g,'&lt;')

blankline   :: (content) => '<div class=blank><br/></div>'

insetblock  :: (content) => `<div class=insetblock>${markit('myword',content)}</div>`

scope		:~ (\S*) \t ([\S\s]*)        :: (_, context, content) =>
                    (context !== '') ?
                        `<span class=myword data-context=${context}>${content}</span>` :
                        (/<[^>]+>/.test(content) ?
                            `<span class=myword>${content}</span>` :
                            content)

markedblock :~ (\S*) \t ([\S\s]*)        :: (_, label, content) =>
                    `<dl><pre><dt><mark>${markit('text', label)}</mark></dt><dd>${markit('text', content)}</dd></pre></dl>`

metajs      :: (javascript) => `<script type=application/javascript>${javascript}</script>`
metacss     :: (css) => `<style scoped>${css}</style>`


// Other default label definitions...

&           = metamark
({|)		= viz [
(|})		= viz ]
// ()          = <span class='inset'> myword
@include    = include
@imbed      = imbedURL

// file type transforms..

.myw        = <div> myword
.txt        = <pre> text

// simple standard HTML5 element names

:abbr           = <abbr>
:address        = <address>
:article        = <article>
:aside          = <aside>
:b              = <b>
:bdi            = <bdi>
:bdo            = <b>
:blockquote     = <blockquote>
:br             = <br/>
:button         = <button>
:cite           = <cite>
:code           = <code> code
:dl             = <dl>
:dd             = <dd>
:dt             = <dt> text
:del            = <del>
:dfn            = <dfn>
:div            = <div>
:em             = <em>
:footer         = <footer>
:h1             = <h1>
:h2             = <h2>
:h3             = <h3>
:h4             = <h4>
:h5             = <h5>
:h6             = <h6>
:header         = <header>
:hr             = <hr/>
:i              = <i>
:ins            = <ins>
:kbd            = <kbd> text
:li             = <li>
:legend         = <legend>
:mark           = <mark>
:ol             = <ol>
:p              = <p>
:pre            = <pre> text
:q              = <q>
:s              = <s>
:samp           = <samp> text
:small          = <small>
:span           = <span>
:strong         = <strong>
:style          = <style> text
:sub            = <sub>
:sup            = <sup>
:table          = <table>
:td             = <td>
:th             = <th>
:tr             = <tr>
:u              = <u>
:ul             = <ul>
:var            = <var>
:wbr            = <wbr/>

// common light-weight markup.....

#       = <h1>
##      = <h2>
###     = <h3>
####    = <h4>
#####   = <h5>
######  = <h6>
*()     = <em>
**      = <strong>
>       = <blockquote>
---     = <hr/>
`       = <code> code
=       = <kbd> text
~       = <u>
~~      = <s>
^       = <sup>
_       = <sub>
/       = <pre> text
//      = <span hidden> text
?       = <mark>

// -       = <ul> list
// +       = <ol> list
// -	    = <li>
// +	    = <li>
// -..	    = <ul style="margin:0px">
// +..     = <ol style="margin:0px">
*       = <div class=mylistitem>
+       = <div class=mylistitem>
-       = <div class=mylistitem>
*..		= <ul style="margin:0px;list-style-type:disc">
1..     = orderedlist decimal
01..	= orderedlist decimal-leading-zero
i..     = orderedlist lower-roman
I..     = orderedlist upper-roman
A..     = orderedlist upper-latin
a..     = orderedlist lower-latin

orderedlist :: (content, type) =>
	`<ol style="margin:0px;list-style-type:${type}">${markit('myword',content)}</ol>`


@       = linkURL
!       = imgURL

link    :: (content, url) => `<a href="${url?url:content}">${markit('text',content)}</a>`

image   :: (_,url) => `<img src=${url}>`

linkURL :: (content, parms) => (
    (url=parms.substring(0,parms.indexOf(' ')), desc=parms.substring(parms.indexOf(' ')).trim()) =>
    `<a href="${markit('text', (url?url:(parms?parms:content)))}">${markit('myword', (content?content:desc))}</a>`
    )()

imgURL  :: (content) => `<img src='${markit('text', content)}'/>`

// id links...

@id = linkID
#id = <b> isID

linkID :: (content) => {
    var id = markit('text', content);
    return "<a href='#"+id+"'>"+id+"</a>";
    }

isID :: (content) => {
    var id = markit('text', content);
    return "<span id='"+id+"'>"+id+"</span>";
    }


// dl terms definition lists...

deflink :: (content) => {
    var key = markit('text',content)
    var id = key.replace(' ','_')
    return "<a href='#def-"+id+"'>"+key+"</a>";
  }

deflist := (blank / key / val)* :: (x) => this.flatten(x).join('')
    key :~ (?: [ ]? [^ \t\n\r])+ :: (dt) =>  {
        var key = markit('text',dt)
        var id = key.replace(' ','_')
        return "<dt id='def-"+id+"'>"+key+"</dt>"
    }
    val :~ (?: (?: [\t]|[ ]{2,8}) [^\n\r]+ %blank*)+ :: (val) =>
        "<dd>"+markit('myword',val)+"</dd>"
    blank :~ [ \t]* (?: \n | \r\n?) :: () => ''

// table array...

.array = <table class=array> array

array := row*                 :: (rows) => this.flatten(rows).join('')
    row   := tsep* cell* nl?  :: (_,cells) => (cells.length>0)? ["<tr>",cells,"</tr>"] : ''
    cell  := item tsep?       :: (item) => ["<td>",markit('myword',this.flatten(item).join('')),"</td>"]
    item  := (!delim char)+
    delim :~ %tsep | %nl
    tsep  :~ ([ ]*[\t]|[ ]{2,}) [ \t]*
    nl    :~ [\n\f]|([\r][\n]?)
    char  :~ [\s\S]

@css
    table.array {border-collapse:collapse;}
    .array td { border:thin solid gray; padding:2pt 10pt; }

// iframe for imbed...

imbedURL :: (content) => {
    var url = markit('text', content);
    return "<iframe src='"+url+"' scrolling=no style='overflow:hidden; border:none; width:100%;'></iframe>";
    }

// useful document elements ......

.eg     = <div class='eg'> code

.demo   = <table class='demo'> demo

demo    :: (content) => "<tr><td class='A1'>" +
                markit('code',content) +
                "</td><td class='B1'>" +
                markit('myword',content) +
                "</td></tr>"

@css
    .eg, table.demo td.A1 {
        padding-left:10pt; padding-right:10pt; padding-top:5pt; padding-bottom:5pt;
        white-space:pre; font-family:monospace; background:whitesmoke;
    }

    table.demo {
        table-layout:fixed; width:100%;
        border-spacing:5pt 0pt;
    }

    .eg, table.demo {
        margin:5pt 0pt;
    }

    table.demo td.A1 {
        width:50%; overflow:hidden; vertical-align:top;
    }

    table.demo td.B1 {
        overflow:hidden; vertical-align:top;
    }

	div.mylistitem {
		display:list-item; margin-left:40px
	}

	ol div.mylistitem, ul div.mylistitem {
		margin-left:0px
	}

