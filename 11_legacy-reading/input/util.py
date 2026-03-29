import re;from datetime import datetime

chk=lambda x:isinstance(x,str)and(lambda d:(d.year>=2000)&(d.year<=2100))(datetime.strptime(x,"%Y-%m-%d"))if isinstance(x,str)and bool(re.match(r"^\d{4}-\d{2}-\d{2}$",x))else False

def fix(s):
    return float(s) if isinstance(s,(int,float))else(lambda v:float(v) if v else 0.0)(re.sub(r"[¥￥,$\s,]","",str(s).strip())or None)

fmt=lambda n:f"{n/1e6:.1f}M"if n>=1e6 else f"{n/1e3:.1f}K"if n>=1e3 else f"{n:,.0f}"
