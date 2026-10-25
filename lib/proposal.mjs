// Uses the supplied EGY Sales-Proposal design, not a recreated cover.
export async function generateProposal(PDFLib,{templateBytes,quote,customer='Customer',customerImage,number,issuedDate,expiresAt,fontBytes,boldBytes,semiBytes,fontkit,approvalRecorded=false}){
 const {PDFDocument,StandardFonts,rgb}=PDFLib;
 if(quote.implementation===null)throw Error('استكمل رسوم التهيئة قبل إصدار البروپوزل.');
 const doc=await PDFDocument.load(templateBytes);doc.setTitle('GeoInTime Quotation '+number);doc.setAuthor('GeoInTime');doc.setSubject('Commercial quotation');doc.setCreator('GeoInTime');doc.setProducer('GeoInTime');
 if(fontkit)doc.registerFontkit(fontkit);
 const page=doc.getPages()[1],H=page.getHeight(),font=await doc.embedFont(fontBytes||StandardFonts.Helvetica,{subset:!!fontBytes}),bold=await doc.embedFont(boldBytes||StandardFonts.HelveticaBold,{subset:!!boldBytes});
 page.pushOperators(PDFLib.beginText(),PDFLib.setCharacterSpacing(0),PDFLib.setWordSpacing(0),PDFLib.setTextRise(0),PDFLib.endText());
 const semi=semiBytes?await doc.embedFont(semiBytes,{subset:true}):bold;
 const ink=rgb(.065,.075,.14),green=rgb(0,.84,.57),line=rgb(.82,.84,.84),mint=rgb(.50,1,.79);
 const amount=n=>(n/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 function text(value,x,top,size=11,weight=font,color=ink,maxWidth){let s=String(value);while(maxWidth&&weight.widthOfTextAtSize(s,size)>maxWidth&&size>6)size-=.25;page.drawText(s,{x,y:H-top-size,size,font:weight,color});}
 function right(value,x,top,size=11,weight=font){text(value,x-weight.widthOfTextAtSize(String(value),size),top,size,weight);}
 // Metadata occupies the reference's unused space between brand and heading.
 text('QUOTATION '+number,365,57,9,bold,ink,238);text('Issued: '+issuedDate,365,74,9);text('Valid through: '+expiresAt,365,88,9);
 if(customerImage){const image=await doc.embedPng(customerImage);page.drawImage(image,{x:365,y:H-126,width:Math.min(238,image.width/3),height:Math.min(24,image.height/3)});}else text('To: '+customer,365,107,10,bold,ink,238);

 const first=quote.schedule[0],beforeDiscount=quote.beforeDiscountMonthly*quote.cycleMonths;
 const rows=[{description:quote.planName,qty:quote.billedEmployees,unit:amount(Math.round(quote.beforeDiscountMonthly/quote.billedEmployees))+'/User/MO x '+quote.cycleMonths,total:beforeDiscount}];
 if(quote.hardwareQty)rows.push({description:'GeoInTime Locator',qty:quote.hardwareQty,unit:amount(Math.round(quote.hardwareUnitPrice*100))+'/Device',total:quote.hardwareTotal});
 rows.push({description:'Implementation',qty:1,unit:amount(quote.implementation),total:quote.implementation});
 if(first.extra)rows.push({description:'Additional subscription',qty:1,unit:amount(first.extra)+'/Period',total:first.extra});
 const otherOnce=quote.extrasOnce-(quote.hardwareTotal||0);if(otherOnce)rows.push({description:'Other one-time fees',qty:1,unit:amount(otherOnce),total:otherOnce});
 const xs=[25,65,193,297,443,604],top=199,header=34,rowH=Math.min(42,126/rows.length),bottom=top+header+rows.length*rowH;
 page.drawRectangle({x:24,y:H-360,width:581,height:127,color:rgb(1,1,1)});
 
 for(let i=0;i<xs.length;i++)page.drawLine({start:{x:xs[i],y:H-top-header},end:{x:xs[i],y:H-bottom},thickness:.8,color:line});
 for(let i=0;i<=rows.length;i++){const y=top+header+i*rowH;page.drawLine({start:{x:xs[0],y:H-y},end:{x:xs[5],y:H-y},thickness:.8,color:line});}
 ['#','Description','Number of users','Monthly /Yearly price','Total'].forEach((h,i)=>text(h,[44.1,72.2,202.7,304.6,453.2][i],205.5,i===2?12:13,semi,ink,xs[i+1]-xs[i]-12));
 rows.forEach((r,i)=>{const y=top+header+i*rowH+(rowH-13)/2;text(i+1,45.9,y,13);text(r.description,72.2,y,13,font,ink,120);text(r.qty,235.1,y,13);text(r.unit,305.8,y,13,font,ink,130);right(amount(r.total),550,y,13);text('EGP',570.9,y,13,semi);});
 const discount=quote.discountMonthly*quote.cycleMonths,subtotal=first.subtotal+discount;
 const sy=Math.max(347.5,bottom+7),gap=(429-sy)/3;
 text('Subtotal:',109.1,sy,14);text(amount(subtotal)+' EGP',167.8,sy,14);
 text('Refund:',109.1,sy+gap,14);text('-',182.3,sy+gap,14);
 text('Discount:',109.1,sy+2*gap,14);text(quote.discount.toFixed(2)+' % (subscription)',165,sy+2*gap,12);
 text('Vat:',109.1,429,14);text(quote.taxRate===null?'Not specified':quote.taxRate.toFixed(2)+' %',147,429,14);
 text('Total',110,469.5,17.83,bold);text(amount(quote.taxRate===null?first.subtotal:first.total),176.2,472,16,bold,ink,74);text('EGP',256.1,469.5,18,semi);
 if((quote.approval.needsApproval||quote.customRequired)&&!approvalRecorded)text('DRAFT - subject to recorded commercial approvals',27,126,9,bold,rgb(.65,.4,.15));
 return doc.save();
}
