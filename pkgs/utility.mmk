@import utility.fw.css

// imbedding .....

@imbed	= <iframe scrolling=no style='overflow:hidden; border:none; width:100%;'>

//    verbatim text elements...

`      	= text <code>
:style 	= text <style scoped>
:script = text <script>

// useful document elements ......

.eg		= text <div class='eg'>

.demo	= demo <table class='demo'>

demo    :: (content) => "<tr><td class='A1'>" + 
                            content.replace(/</g,'&lt;') + 
                            "</td><td class='B1'>" +
                            markit('myword',content) +
                            "</td></tr>"
												
.table	= tsv <table class=tsv>

tsv         := header datarow*              :: (header, rows) => this.flatten(header.concat(rows)).join('')
	header  := tsep* hdritem+               :: (_,hdr) => ["<tr>",hdr,"</tr>"]
	hdritem := item tsep?                   :: (item) => ["<th>",this.flatten(item).join('').replace(/</g,'&lt;'),"</th>"]
	datarow := newline tsep* datitem*       :: (_0,_1,data) => ["<tr>",data,"</tr>"] 
	datitem := item tsep?                   :: (item) => ["<td>",this.flatten(item).join('').replace(/</g,'&lt;'),"</td>"]
	item    := (!delim char)+
	delim   :~ %tsep | %newline
	tsep    :~ [\t]|[ ]{4,}
	newline :~ [\n\f]|([\r][\n]?)
	char    :~ [\s\S]

bartab		:: (content) => {
                    var t = "";
                    var rows = content.split("\n");
                    var head = true;
                    var align = [];
                    for (var i=0; i<rows.length; i+=1) {
                        var row = rows[i];
                        if (!row) continue;
                        var cells = row.split('|');
                        t += "<tr>";
                        for (var j=0; j<cells.length; j+=1) {
                            var cell = cells[j];
                            if (!cell) continue;
                            if (head) {
                                align[j] = "";
                                var hdr = cell.match(/^([:])*(.*?)([:])?$/);
                                if (hdr[1] && hdr[3]) { // center
                                    align[j] = "style='text-align:center'";
                                } else if (hdr[1]) { // left
                                    align[j] = "style='text-align:left'";
                                } else if (hdr[3]) { // right
                                    align[j] = "style='text-align:right'";
                                }
                                t += "<th>"+hdr[2].trim().replace(/</g,'&lt;')+"</th>";
                            } else { // data...
                                t += "<td "+align[j]+">"+cell.replace(/</g,'&lt;')+"</td>";
                            }
                        }
                        t += "</tr>";
                        head = false;
                    }
                    return t;
                }


// some defns that I like ...

_      = <sub>
^      = <sup>
.bold  = <b>



