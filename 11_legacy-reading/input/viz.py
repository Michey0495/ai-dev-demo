import pandas as pd;import os
from cfg import O,E;from util import fmt

def mk(df,p="summary.csv"):
    os.makedirs(O,exist_ok=True);o=os.path.join(O,p);out=df.copy()
    [out.__setitem__(c,out[c].apply(fmt))for c in out.select_dtypes(include=["float64","int64"]).columns if c not in("rank","m","n","cnt")]
    out.to_csv(o,index=False,encoding=E);return o

def rpt(df,df2=None):
    os.makedirs(O,exist_ok=True);o=os.path.join(O,"report.txt")
    L=["="*60,"  SALES REPORT","="*60,""]
    L+=[f"  Total Sales: {fmt(df['total'].sum())}",f"  Average Daily: {fmt(df['total'].mean())}",f"  Peak Day: {fmt(df['total'].max())}",f"  Records: {len(df)}",""]if "total" in df.columns else[""]
    if df2 is not None and "g" in df2.columns:
        g=df2["g"].dropna();L+=["-"*60,"  YEAR-OVER-YEAR","-"*60,f"  Avg Growth: {g.mean():.1f}%",f"  Positive: {(g>0).sum()}  Negative: {(g<=0).sum()}"]
    L+=["","="*60]
    with open(o,"w",encoding=E)as f:f.write("\n".join(L))
    return o
