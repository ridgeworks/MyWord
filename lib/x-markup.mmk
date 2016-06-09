
@import x-markup.css

// definitions...

&           = metamark
@include    = import  

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
:hr             = <hr> 
:i              = <i> 
:ins            = <ins>
:kbd            = text <kbd>
:legend         = <legend>
:mark           = <mark> 
:p              = <p> 
:pre            = text <pre>
:q              = <q> 
:s              = <s> 
:samp           = <samp>
:script         = text <script> 
:small          = <small>
:span           = <span>
:strong         = <strong> 
:style          = text <style scoped> 
:sub            = <sub>
:sup            = <sup> 
:u              = <u>
:var            = <var> 
:wbr            = <wbr/>  

// imbedding .....

@imbed  = <iframe scrolling=no style='overflow:hidden; border:none; width:100%;'>

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
//      = <span hidden>
?       = <mark>

@       = linkURL
!       = imgURL

linkURL :: (content) => { 
    var url = markit('text', content); 
    return "<a href='"+url+"'>"+url+"</a>";
    }

imgURL :: (content) =>   "<img src='"+content+"'/>"

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

// dl terms definition lists...  .

terms = terms <dl class=terms>

terms :: (content) => {
    var dl = "";
    var dd = "";
    var lines = content.split('\n');
    for (var i=0; i<lines.length; i++) {  
        var line = lines[i];
        if (!line) continue;
            if (!line.match(/^\s/)) { // no indent  
            if (dd) { dl += "<dd>" + markit("myword",dd) + "</dd>"; }
            dd = "";
            dl += "<dt>" + markit("text",line) + "</dt>";
        } else { // indented..
            dd += line.trim()+'\n';
        }
    }
    if (dd) { dl += "<dd>" + markit("myword",dd) + "</dd>"; }
    return dl;
    }

// table array...  .

array = array <table class=array>

  array := row*                 :: (rows) => this.flatten(rows).join('')
    row   := tsep* cell* nl?  :: (_,cell) => ["<tr>",cell,"</tr>"] 
    cell  := item tsep?       :: (item) => ["<td>",markit('prose',this.flatten(item).join('')),"</td>"] 
    item  := (!delim char)+
    delim :~ %tsep | %nl 
    tsep  :~ ([ ]*[\t]|[ ]{2,}) [ \t]* 
    nl    :~ [\n\f]|([\r][\n]?)
    char  :~ [\s\S]   

// useful document elements ......  .

.eg     = text <div class='eg'>

.demo   = demo <table class='demo'>

demo    :: (content) => "<tr><td class='A1'>" + 
                content.replace(/</g,'&lt;') + 
                "</td><td class='B1'>" + 
                markit('myword',content) + 
                "</td></tr>"
