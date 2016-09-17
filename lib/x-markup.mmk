
// definitions...

&           = metamark
()          = <span class='inset'>
@include    = include
@imbed      = imbedURL

// file type transforms..

.myw        = myword
.txt        = text <pre>

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
:code           = text <code>
:dl             = <dl>
:dd             = <dd>
:dt             = text <dt>
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
:kbd            = text <kbd>
:li             = <li>
:legend         = <legend>
:mark           = <mark>
:ol             = <ol>
:p              = <p>
:pre            = text <pre>
:q              = <q>
:s              = <s>
:samp           = text <samp>
:small          = <small>
:span           = <span>
:strong         = <strong>
:style          = text <style scoped>
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
*       = <em>
**      = <strong>
>       = <blockquote>
---     = <hr/>
-       = list <ul>
+       = list <ol>
`       = text <code>
=       = text <kbd>
~       = <u>
~~      = <s>
^       = <sup>
_       = <sub>
/       = text <pre>
//      = text <span hidden>
?       = <mark>

@       = linkURL
!       = imgURL

linkURL :: (content) => {
    var url = markit('text', content);
    return "<a href='"+url+"'>"+url+"</a>";
    }

imgURL :: (content) =>  "<img src='"+content+"'/>"

// id links...

@id = linkID
#id = isID <b>

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

.array = array <table class=array>

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

.eg     = text <div class='eg'>

.demo   = demo <table class='demo'>

demo    :: (content) => "<tr><td class='A1'>" +
                markit('text',content) +
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
