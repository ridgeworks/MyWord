// common light-weight markup.....

#		= <h1>
##		= <h2>
###		= <h3>
####	= <h4>
#####	= <h5>
######	= <h6>

>		= <blockquote>
---		= <hr>

-		= list <ul>
*		= -
+		= list <ol>

~		= <i>
!		= <b>

@       = linkURL

linkURL    :: (url) => { return "<a href='"+url+"'>"+url+"</a>"};

^		= <sup>
_		= <sub>




//		*[for emphasis]		__[bold]		--[strike-through]		--[[strike]through]]

// Symmetric notation - advantage: can use RE to parse	/\s*([^|\s]+)(\|+)((?:(?:[\s\S])(?!\2))+[\s\S])\2/
// Grammar? - produces sequence of single chars and inline elments
// prose 	:= ((!inline textChar)* | inline)*
//	inline	:~ /([^|\s]+)(\|+)((?:(?:[\s\S])(?!\2))+[\s\S])\2/
//	textChr	:~ [\s\S]
//
// Test:  Now is the time *|for all| good men to come to the aid of the _||par|y|| | |  ?|12|

//		*|for emphasis|		__|bold|		--|strike-through|		--||strike|through||

//		*`for emphasis`		__`bold`		--`strike-through`		--``strike`through``

//		*\for emphasis\		__\bold\		--\strike-through\		--\\strike\through\\

//		*~for emphasis~		__~bold~		--~strike-through~		--~~strike~through~~


