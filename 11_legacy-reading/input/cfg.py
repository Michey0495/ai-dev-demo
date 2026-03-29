import os
_=os.path;B=_.dirname;J=_.join
P=J(B(__file__),"..","data");O=J(B(__file__),"..","output")
D={chr(i):v for i,v in zip(range(97,102),["売上日","商品名","カテゴリ","金額","個数"])}
S={v:k for k,v in D.items()}
F,F2=[J(P,f) for f in("sales.csv","sales_prev.csv")]
E="utf-8-sig"
T,W,Q=0.05,7,[3,6,9,12]
_R={"H":[1,0,0],"M":[0,1,0],"L":[0,0,1]}
_V=lambda k:_R.get(k,[0]*3)
