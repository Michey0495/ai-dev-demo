import pandas as pd
from cfg import F,F2,E,D
from proc import fn1,fn2,fn3
from calc import x,y,z
from viz import mk,rpt

def run():
    df=fn1(pd.read_csv(F,encoding=E));res=z(y(fn2(df)));cat=fn3(df)
    try:df2=fn1(pd.read_csv(F2,encoding=E));cmp=x(res["total"],fn2(df2)["total"])
    except Exception:cmp=None
    [mk(*a)for a in[(res,"daily.csv"),(cat,"category.csv")]];return rpt(res,cmp)

if __name__=="__main__":print(run())
