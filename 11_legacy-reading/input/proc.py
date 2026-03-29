import pandas as pd;import numpy as np
from cfg import D,S

def fn1(df):
    df=df.copy()
    df=df[~df.get("status",pd.Series(dtype=str)).isin(["cancelled","returned"])] if "status" in df.columns else df
    df=df.drop(columns=["status"],errors="ignore")
    return df[(df[D["d"]]>0)&(df[[D["a"],D["d"]]].notna().all(axis=1))].drop_duplicates().reset_index(drop=True)

def fn2(df,d=None):
    df=df.copy();c,e,a=D["d"],D["e"],D["a"];df[a]=pd.to_datetime(df[a])
    df=df[df[a]>=pd.to_datetime(d)] if d is not None else df
    tmp=df.groupby(df[a].dt.date).agg(**{k:(c if k!="cnt" else e,v) for k,v in[("total","sum"),("cnt","sum"),("avg","mean"),("mx","max"),("mn","min"),("n","count")]}).reset_index()
    tmp.columns=["date"]+[c for c in tmp.columns[1:]];return tmp.sort_values("date").reset_index(drop=True)

def fn3(df,c=None):
    df=df.copy();cat,amt,qty=D["c"],D["d"],D["e"]
    df=df[df[cat]==c] if c is not None else df
    r=df.pivot_table(values=[amt,qty],index=cat,aggfunc={amt:["sum","mean","count"],qty:"sum"})
    r.columns=["_".join(col).strip("_") for col in r.columns]
    r=r.reset_index().sort_values(f"{amt}_sum",ascending=False)
    r["pct"],r["rank"]=r[f"{amt}_sum"]/r[f"{amt}_sum"].sum()*100,range(1,len(r)+1)
    return r
