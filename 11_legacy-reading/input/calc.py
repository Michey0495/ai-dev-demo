import pandas as pd;import numpy as np
from cfg import W,Q

def x(a,b):
    a,b=[pd.Series(s).reset_index(drop=True)for s in(a,b)]
    if len(a)!=len(b):a,b=[s.iloc[:min(len(a),len(b))]for s in(a,b)]
    r=pd.DataFrame({"cur":a,"prev":b})
    r["g"],r["d"]=np.where(r["prev"]!=0,(r["cur"]-r["prev"])/r["prev"]*100,np.nan),r["cur"]-r["prev"]
    return r

def y(df):
    df=df.copy();t=next((c for c in["total","sum"]if c in df.columns),df.columns[1])
    df["ma"],df["std"]=[df[t].rolling(window=W,min_periods=1).agg(f)for f in["mean","std"]]
    df["std"]=df["std"].fillna(0)
    df["upper"],df["lower"]=df["ma"]+2*df["std"],df["ma"]-2*df["std"]
    df["anomaly"]=(df[t]>df["upper"])|(df[t]<df["lower"])
    return df

def z(df,t="total"):
    df=df.copy()
    df["m"]=pd.to_datetime(df["date"]).dt.month if "date" in df.columns else(df["m"] if "m" in df.columns else pd.Series(range(1,len(df)+1))%12+1)
    s=df.groupby("m")[t].mean();gs=s.mean();si=s/gs if gs!=0 else s
    df["si"],df["adj"]=df["m"].map(si),np.where(df["m"].map(si)!=0,df[t]/df["m"].map(si),df[t])
    df["trend"]=df["adj"].rolling(window=3,min_periods=1).mean()
    return df
