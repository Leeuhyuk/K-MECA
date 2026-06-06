/* ════════ 로컬 스토리지 연동 및 초기 데이터 정의 ════════ */

const defaultRfqList  = [{"id":"Q-260530-0001","date":"2026-05-30","dueDate":"2026-06-06","clientId":"CL-006","productId":"PR-003","supplier":"예주산업","supplierEmail":"kim@yeju.co.kr","itemName":"알루미늄 프로파일 40×40","spec":"40×40mm, 6063-T5","qty":20,"unit":"M","targetPrice":8500,"status":"요청중","note":""},{"id":"Q-260530-0002","date":"2026-05-30","dueDate":"2026-06-07","clientId":"CL-006","productId":"PR-009","supplier":"제이씨인터내쇼날","supplierEmail":"lee@jci.co.kr","itemName":"감속기 KF60-1/20-200W","spec":"비율 1:20, 200W, 플랜지형","qty":2,"unit":"EA","targetPrice":200000,"status":"회신완료","note":"도면 전달 완료"},{"id":"Q-260529-0001","date":"2026-05-29","dueDate":"2026-06-05","clientId":"CL-007","productId":"PR-013","supplier":"모티브","supplierEmail":"park@motive.co.kr","itemName":"레이저 가공","spec":"SUS304, t3.0mm","qty":1,"unit":"SET","targetPrice":0,"status":"채택","note":"도면 첨부 완료"},{"id":"Q-260528-0001","date":"2026-05-28","dueDate":"2026-06-04","clientId":"CL-006","productId":"PR-008","supplier":"동우유공압","supplierEmail":"song@dongwoo.co.kr","itemName":"에어실린더","spec":"ø50×150 stroke, SMC호환","qty":2,"unit":"EA","targetPrice":180000,"status":"미채택","note":"타사 제품으로 대체"},{"id":"Q-260527-0001","date":"2026-05-27","dueDate":"2026-06-03","clientId":"CL-002","productId":"PR-004","supplier":"성우에프에이","supplierEmail":"kang@seongwoofa.co.kr","itemName":"포토센서 10개입","spec":"배리어타입, NPN출력","qty":2,"unit":"BOX","targetPrice":45000,"status":"요청중","note":"브래킷 포함 견적 요망"},{"id":"Q-260526-0001","date":"2026-05-26","dueDate":"2026-06-02","clientId":"CL-001","productId":"PR-001","supplier":"화성기공","supplierEmail":"lee@hwaseong.co.kr","itemName":"프레임 제관 및 도장","spec":"40×40mm 조립프레임 외주가공","qty":1,"unit":"SET","targetPrice":850000,"status":"회신완료","note":"용접 규격 준수 요망"},{"id":"Q-260525-0001","date":"2026-05-25","dueDate":"2026-06-01","clientId":"CL-002","productId":"PR-005","supplier":"삼아콘트롤스","supplierEmail":"yoon@sama.co.kr","itemName":"에어 필터 레귤레이터","spec":"SMC형식 AW20-02BG-A","qty":5,"unit":"EA","targetPrice":24000,"status":"채택","note":"긴급 납기 요망"},{"id":"Q-260524-0001","date":"2026-05-24","dueDate":"2026-05-31","clientId":"CL-003","productId":"PR-006","supplier":"대양특수강","supplierEmail":"lim@daeyangsteel.co.kr","itemName":"S45C 환봉 가공소재","spec":"ø50×300L, 양끝단 센터가공","qty":4,"unit":"EA","targetPrice":18500,"status":"채택","note":"면취 정밀 가공 포함"},{"id":"Q-260523-0001","date":"2026-05-23","dueDate":"2026-05-30","clientId":"CL-001","productId":"PR-002","supplier":"영진테크","supplierEmail":"cho@youngjintech.co.kr","itemName":"아크릴 보호 커버","spec":"투명 아크릴 5T, 면취 가공","qty":1,"unit":"SET","targetPrice":120000,"status":"미채택","note":"사내 자체 제작으로 선회"}];
const defaultPoList   = [{"id":"P-260530-0001","date":"2026-05-30","dueDate":"2026-06-13","clientId":"CL-006","productId":"PR-009","supplier":"제이씨인터내쇼날","supplierEmail":"lee@jci.co.kr","itemName":"감속기","spec":"KF60-1/20-200W, 플랜지형","qty":2,"unit":"EA","unitPrice":203800,"payMethod":"현금","dlvMethod":"직납","status":"발송완료","note":""},{"id":"P-260530-0002","date":"2026-05-30","dueDate":"2026-06-10","clientId":"CL-006","productId":"PR-003","supplier":"예주산업","supplierEmail":"kim@yeju.co.kr","itemName":"알루미늄 프로파일 40×40","spec":"6063-T5, 4M 기준","qty":20,"unit":"M","unitPrice":8500,"payMethod":"현금","dlvMethod":"택배","status":"작성중","note":""},{"id":"P-260529-0001","date":"2026-05-29","dueDate":"2026-06-07","clientId":"CL-007","productId":"PR-013","supplier":"대성베어링","supplierEmail":"choi@daesung.co.kr","itemName":"베어링","spec":"6205-2RS","qty":1,"unit":"EA","unitPrice":9240,"payMethod":"현금","dlvMethod":"택배","status":"입고완료","note":""},{"id":"P-260528-0001","date":"2026-05-28","dueDate":"2026-06-05","clientId":"CL-006","productId":"PR-007","supplier":"동우유공압","supplierEmail":"song@dongwoo.co.kr","itemName":"에어실린더 外","spec":"ø50×150 stroke 外 5종","qty":1,"unit":"LOT","unitPrice":280600,"payMethod":"현금","dlvMethod":"직납","status":"확인완료","note":"거래명세표 수령 완료"},{"id":"P-260527-0001","date":"2026-05-27","dueDate":"2026-06-10","clientId":"CL-002","productId":"PR-004","supplier":"성우에프에이","supplierEmail":"kang@seongwoofa.co.kr","itemName":"포토센서 10개입","spec":"배리어타입, NPN출력","qty":2,"unit":"BOX","unitPrice":45000,"payMethod":"현금","dlvMethod":"택배","status":"발송완료","note":"빠른 배송 바람"},{"id":"P-260526-0001","date":"2026-05-26","dueDate":"2026-06-15","clientId":"CL-001","productId":"PR-001","supplier":"화성기공","supplierEmail":"lee@hwaseong.co.kr","itemName":"프레임 제관 및 도장","spec":"40×40mm 조립프레임 외주가공","qty":1,"unit":"SET","unitPrice":850000,"payMethod":"현금","dlvMethod":"직납","status":"확인완료","note":"검수 성적서 동봉 요망"},{"id":"P-260525-0001","date":"2026-05-25","dueDate":"2026-06-05","clientId":"CL-002","productId":"PR-005","supplier":"삼아콘트롤스","supplierEmail":"yoon@sama.co.kr","itemName":"에어 필터 레귤레이터","spec":"SMC형식 AW20-02BG-A","qty":5,"unit":"EA","unitPrice":24000,"payMethod":"현금","dlvMethod":"택배","status":"입고완료","note":"품질 검토 통과"},{"id":"P-260524-0001","date":"2026-05-24","dueDate":"2026-06-02","clientId":"CL-003","productId":"PR-006","supplier":"대양특수강","supplierEmail":"lim@daeyangsteel.co.kr","itemName":"S45C 환봉 가공소재","spec":"ø50×300L, 양끝단 센터가공","qty":4,"unit":"EA","unitPrice":18500,"payMethod":"현금","dlvMethod":"화물","status":"입고완료","note":""},{"id":"P-260522-0001","date":"2026-05-22","dueDate":"2026-06-01","clientId":"CL-001","productId":"PR-002","supplier":"성신테크","supplierEmail":"jung@sungshin.co.kr","itemName":"유압실린더 커버 가공","spec":"AL6061 정밀 머시닝가공","qty":1,"unit":"SET","unitPrice":350000,"payMethod":"현금","dlvMethod":"직납","status":"입고완료","note":"완전 납품 및 합격"}];
const defaultPartners = [{"id":"BP-001","name":"예주산업","type":"공급처","manager":"김예주","tel":"031-123-4567","mobile":"010-1234-5678","email":"kim@yeju.co.kr","fax":"031-123-4568","bizNo":"123-45-67890","address":"경기도 화성시 봉담읍 산업단지로 10","note":"알루미늄 프로파일 전문 공급"},{"id":"BP-002","name":"제이씨인터내쇼날","type":"공급처","manager":"이진철","tel":"031-234-5678","mobile":"010-2345-6789","email":"lee@jci.co.kr","fax":"","bizNo":"234-56-78901","address":"경기도 안양시 만안구 산업로 55","note":"감속기·모터 전문 공급"},{"id":"BP-003","name":"모티브","type":"외주처","manager":"박모범","tel":"031-345-6789","mobile":"010-3456-7890","email":"park@motive.co.kr","fax":"","bizNo":"345-67-89012","address":"경기도 평택시 청북읍 현곡2로 20","note":"레이저 가공 전문"},{"id":"BP-004","name":"대성베어링","type":"공급처","manager":"최대성","tel":"02-456-7890","mobile":"010-4567-8901","email":"choi@daesung.co.kr","fax":"","bizNo":"456-78-90123","address":"서울시 구로구 구로동 디지털로 100","note":"베어링 전문 유통"},{"id":"BP-005","name":"성신테크","type":"외주처","manager":"정성신","tel":"031-567-8901","mobile":"010-5678-9012","email":"jung@sungshin.co.kr","fax":"","bizNo":"567-89-01234","address":"경기도 수원시 팔달구 인계로 30","note":"선반·밀링 정밀 가공"},{"id":"BP-006","name":"동우유공압","type":"공급처","manager":"송동우","tel":"032-678-9012","mobile":"010-6789-0123","email":"song@dongwoo.co.kr","fax":"","bizNo":"678-90-12345","address":"인천시 남동구 논현동 유통단지 5","note":"에어실린더·유공압 부품"},{"id":"BP-007","name":"신우상공사","type":"공급처","manager":"신민호","tel":"031-789-0123","mobile":"010-7890-1234","email":"shin@sinwoo.co.kr","fax":"","bizNo":"789-01-23456","address":"경기도 시흥시 정왕동 테크노파크","note":"LM가이드·볼스크류 전문"},{"id":"BP-008","name":"현대리바트","type":"구매처","manager":"김현대","tel":"031-890-1234","mobile":"010-8901-2345","email":"kim@hyundai-livart.co.kr","fax":"031-890-1235","bizNo":"890-12-34567","address":"경기도 이천시 부발읍 공단로 50","note":"의자 내구성 시험기 주요 납품처"},{"id":"BP-009","name":"한컴라이프케어","type":"구매처","manager":"이한컴","tel":"031-901-2345","mobile":"010-9012-3456","email":"lee@hancom-lifecare.co.kr","fax":"","bizNo":"901-23-45678","address":"경기도 성남시 분당구 황새울로 200","note":"방호 장비 시험기 납품"},{"id":"BP-010","name":"큐로시험소","type":"구매처","manager":"박큐로","tel":"031-012-3456","mobile":"010-0123-4567","email":"park@quro.co.kr","fax":"","bizNo":"012-34-56789","address":"경기도 용인시 처인구 원삼면 산업로 15","note":"기계적 내구력 시험기 납품"},{"id":"BP-011","name":"화성기공","type":"외주처","manager":"이화성","tel":"031-987-6543","mobile":"010-9876-5432","email":"lee@hwaseong.co.kr","fax":"031-987-6544","bizNo":"987-65-43210","address":"경기도 화성시 우정읍 쌍봉로 45","note":"정밀 대형 프레임 제관 및 도장"},{"id":"BP-012","name":"성우에프에이","type":"공급처","manager":"강성우","tel":"02-234-5678","mobile":"010-8765-4321","email":"kang@seongwoofa.co.kr","fax":"","bizNo":"234-81-90123","address":"서울시 구로구 경인로 53길 90","note":"센서 및 제어 기기 전문 유통"},{"id":"BP-013","name":"대양특수강","type":"공급처","manager":"임대양","tel":"032-456-7890","mobile":"010-7654-3210","email":"lim@daeyangsteel.co.kr","fax":"","bizNo":"345-86-01234","address":"인천시 서구 가좌동 산업단지 12","note":"가공용 환봉 및 판재 특수강 공급"},{"id":"BP-014","name":"영진테크","type":"외주처","manager":"조영진","tel":"031-876-5432","mobile":"010-6543-2109","email":"cho@youngjintech.co.kr","fax":"","bizNo":"456-87-12345","address":"경기도 시흥시 공단1대로 120","note":"판금 가공 및 도금 전문"},{"id":"BP-015","name":"삼아콘트롤스","type":"공급처","manager":"윤삼아","tel":"031-765-4321","mobile":"010-5432-1098","email":"yoon@sama.co.kr","fax":"","bizNo":"567-88-23456","address":"경기도 안산시 단원구 번영로 80","note":"밸브 및 유체제어 부품 공급"}];
let rfqList  = [];
let poList   = [];
let partners = [];
let inventoryLedger = [];  // 재고 입출고 이력
let alimtalkSettings = {}; // 카카오 알림톡 설정

const defaultClients = [
  {id:'CL-001',name:'현대리바트',manager:'김영수',tel:'031-1234-5678',email:'kim@hyundai-livart.co.kr',date:'2026-05-01',note:''},
  {id:'CL-002',name:'한샘',manager:'이민정',tel:'02-3455-6789',email:'lee@hanssem.com',date:'2026-05-05',note:''},
  {id:'CL-003',name:'시디즈',manager:'박준혁',tel:'032-789-0123',email:'park@sidiz.com',date:'2026-05-10',note:''},
];

const defaultStatementList = [
  {id:'TS-260501-0001',date:'2026-05-15',clientId:'CL-001',productId:'PR-001',clientEmail:'kim@hyundai-livart.co.kr',itemName:'등판내구성 시험기',spec:'ISO 7173',qty:2,unit:'대',unitPrice:8500000,note:'납품 완료분',status:'발송완료'},
];
const defaultTaxList = [
  {id:'TX-260501-0001',date:'2026-05-20',clientId:'CL-001',productId:'PR-002',clientEmail:'kim@hyundai-livart.co.kr',itemName:'좌판시험기',spec:'KS G 2016',qty:1,unit:'대',unitPrice:6200000,note:'',status:'발행완료'},
];
const defaultQuoteList = [
  {id:'QT-260501-0001',date:'2026-05-10',clientId:'',clientName:'한샘',clientEmail:'lee@hanssem.com',itemName:'높이조절 내구성 시험기',spec:'BIFMA X5.1',qty:1,unit:'대',unitPrice:7200000,deliveryDate:'2026-08-01',note:'견적 협의 진행 중',status:'발송',orderId:''},
];
const defaultOrderList = [];

const defaultProducts = [
  {id:'PR-001',clientId:'CL-001',name:'등판내구성 시험기',spec:'ISO 7173',qty:2,unit:'대',price:8500000,matCost:3200000,laborCost:1500000,ovhCost:700000,deliveryDate:'2026-07-15',status:'생산중',processStage:'조립',processMemo:'볼스크류 입고 후 조립 완료 예정',note:''},
  {id:'PR-002',clientId:'CL-001',name:'좌판시험기',spec:'KS G 2016',qty:1,unit:'대',price:6200000,matCost:2600000,laborCost:1100000,ovhCost:500000,deliveryDate:'2026-07-30',status:'자재준비',processStage:'자재발주',processMemo:'PLC 납기 확인 필요',note:''},
  {id:'PR-003',clientId:'CL-001',name:'팔걸이 내구성 시험기',spec:'EN 581',qty:1,unit:'대',price:5800000,matCost:2400000,laborCost:1000000,ovhCost:450000,deliveryDate:'2026-08-15',status:'설계중',processStage:'설계/도면',processMemo:'',note:''},
  {id:'PR-004',clientId:'CL-002',name:'높이조절 내구성 시험기',spec:'BIFMA X5.1',qty:3,unit:'대',price:7200000,matCost:3000000,laborCost:1300000,ovhCost:600000,deliveryDate:'2026-08-01',status:'자재준비',processStage:'자재발주',processMemo:'',note:''},
  {id:'PR-005',clientId:'CL-002',name:'회전 내구성 시험기',spec:'BIFMA X5.1',qty:2,unit:'대',price:5500000,matCost:2300000,laborCost:950000,ovhCost:420000,deliveryDate:'2026-08-20',status:'견적',processStage:'설계/도면',processMemo:'',note:''},
  {id:'PR-006',clientId:'CL-003',name:'좌면압력 분포 측정기',spec:'맞춤 사양',qty:1,unit:'대',price:12000000,matCost:5200000,laborCost:2100000,ovhCost:900000,deliveryDate:'2026-09-01',status:'견적',processStage:'설계/도면',processMemo:'',note:''},
];

const defaultMaterials = [
  {id:'MT-001',productId:'PR-001',name:'각파이프 40×40×2T',supplier:'동국제강',unitPrice:15000,qty:12,unit:'M',orderDate:'2026-05-10',expectedDate:'2026-05-20',status:'입고완료',note:''},
  {id:'MT-002',productId:'PR-001',name:'볼스크류 SFU1605',supplier:'삼익THK',unitPrice:85000,qty:2,unit:'EA',orderDate:'2026-05-10',expectedDate:'2026-05-25',status:'발주중',note:''},
  {id:'MT-003',productId:'PR-001',name:'선반가공품 A형',supplier:'정밀기계공업사',unitPrice:45000,qty:4,unit:'EA',orderDate:'2026-05-12',expectedDate:'2026-05-28',status:'발주중',note:'도면 전달 완료'},
  {id:'MT-004',productId:'PR-001',name:'LM가이드 MGN12H',supplier:'삼익THK',unitPrice:32000,qty:4,unit:'EA',orderDate:'2026-05-10',expectedDate:'2026-05-22',status:'입고완료',note:''},
  {id:'MT-005',productId:'PR-001',name:'서보모터 200W',supplier:'LS산전',unitPrice:185000,qty:1,unit:'EA',orderDate:'',expectedDate:'2026-06-02',status:'발주전',note:'스펙 확인 필요'},
  {id:'MT-006',productId:'PR-001',name:'알루미늄 프로파일 40×40',supplier:'알파알루미늄',unitPrice:8500,qty:20,unit:'M',orderDate:'',expectedDate:'2026-05-25',status:'발주전',note:''},
  {id:'MT-007',productId:'PR-002',name:'각파이프 50×50×3T',supplier:'동국제강',unitPrice:22000,qty:8,unit:'M',orderDate:'2026-05-15',expectedDate:'2026-05-25',status:'발주중',note:''},
  {id:'MT-008',productId:'PR-002',name:'유압실린더 50×150',supplier:'진영유압',unitPrice:125000,qty:1,unit:'EA',orderDate:'2026-05-15',expectedDate:'2026-05-30',status:'발주중',note:''},
  {id:'MT-009',productId:'PR-002',name:'로드셀 500kgf',supplier:'CAS',unitPrice:98000,qty:1,unit:'EA',orderDate:'',expectedDate:'',status:'발주전',note:''},
  {id:'MT-010',productId:'PR-002',name:'PLC 미쯔비시 FX3U',supplier:'미쯔비시전기',unitPrice:320000,qty:1,unit:'EA',orderDate:'',expectedDate:'',status:'발주전',note:'납기 6주 확인필요'},
  {id:'MT-011',productId:'PR-004',name:'스텝모터 Nema23',supplier:'오리엔탈모터',unitPrice:75000,qty:3,unit:'EA',orderDate:'2026-05-18',expectedDate:'2026-05-28',status:'발주중',note:''},
  {id:'MT-012',productId:'PR-004',name:'볼스크류 SFU2005',supplier:'삼익THK',unitPrice:95000,qty:3,unit:'EA',orderDate:'2026-05-18',expectedDate:'2026-05-30',status:'발주중',note:''},
  {id:'MT-013',productId:'PR-004',name:'철판 레이저컷팅',supplier:'강남레이저',unitPrice:35000,qty:6,unit:'EA',orderDate:'',expectedDate:'',status:'발주전',note:'도면 작성중'},
];

const defaultWorkOrders = [
  {id:'WO-001',clientId:'CL-001',productId:'PR-001',line:'라인 A',qty:2,done:1,defect:0,start:'2026-05-20',due:'2026-07-15',status:'진행중',manager:'김민준',note:''},
  {id:'WO-002',clientId:'CL-001',productId:'PR-002',line:'라인 B',qty:1,done:0,defect:0,start:'2026-06-01',due:'2026-07-30',status:'대기',manager:'이서연',note:'자재 입고 후 시작'},
  {id:'WO-003',clientId:'CL-002',productId:'PR-004',line:'라인 A',qty:3,done:0,defect:0,start:'2026-06-10',due:'2026-08-01',status:'대기',manager:'최유진',note:''},
];

const defaultWorkers = [
  {id:'E-001',name:'김민준',dept:'생산부',position:'반장',empType:'정규직',hireDate:'2019-03-02',phone:'010-1234-0001',salary:3800000,annualLeave:15,line:'A',role:'조립',tin:'08:00',ot:'1.5h',status:'근무중'},
  {id:'E-002',name:'이서연',dept:'생산부',position:'사원',empType:'정규직',hireDate:'2021-07-15',phone:'010-1234-0002',salary:3200000,annualLeave:15,line:'A',role:'가공',tin:'08:00',ot:'0h',status:'근무중'},
  {id:'E-003',name:'박지호',dept:'품질관리부',position:'주임',empType:'정규직',hireDate:'2020-05-04',phone:'010-1234-0003',salary:3400000,annualLeave:15,line:'B',role:'검사',tin:'08:00',ot:'0h',status:'정비지원'},
  {id:'E-004',name:'최유진',dept:'생산부',position:'사원',empType:'계약직',hireDate:'2023-09-01',phone:'010-1234-0004',salary:2900000,annualLeave:12,line:'C',role:'조립',tin:'08:00',ot:'2.0h',status:'근무중'},
];

const defaultDefects = [
  {id:'DF-001',productId:'PR-001',date:'2026-05-18',stage:'가공/제작',type:'치수 불량',qty:1,cause:'공구 마모',action:'재가공',status:'완료',note:''},
  {id:'DF-002',productId:'PR-001',date:'2026-05-20',stage:'조립',type:'체결 불량',qty:2,cause:'토크 미달',action:'재조립',status:'조치중',note:''},
];

const defaultClaims = [
  {id:'CLM-001',date:'2026-05-15',clientId:'CL-001',productId:'PR-001',content:'납품 부품 모서리 마감 미흡',status:'처리중',response:'현장 출장 디버링 예정'},
];

const defaultCheckRecords = [
  {id:'CHK-001',date:'2026-05-21',clientId:'CL-001',productId:'PR-001',inspector:'김기정',visual:'합격',dim:'합격',func:'합격',result:'합격',note:'최종 승인 검수 완료'}
];

const defaultAlerts = [
  {type:'err',title:'MT-005 서보모터 발주 필요 — 등판내구성 시험기 납기 임박',sub:'예상 입고일 06/02 · 아직 발주 전'},
  {type:'err',title:'MT-009, MT-010 로드셀·PLC 발주 미처리 — 좌판시험기',sub:'입고 예정일 미설정 · 즉시 발주 필요'},
  {type:'warn',title:'MT-013 철판 레이저컷팅 발주전 — 도면 작성 중',sub:'높이조절 내구성 시험기 납기 08/01'},
];

const defaultInventory = [
  {id:'INV-001',category:'생산부품',name:'각파이프 40×40×2T',type:'자재',qty:120,unit:'M',minQty:50,location:'A동 자재랙 1열',note:'동국제강'},
  {id:'INV-002',category:'생산부품',name:'서보모터 200W',type:'자재',qty:3,unit:'EA',minQty:5,location:'B동 전자소자 보관함',note:'안전재고 부족 경보!'},
  {id:'INV-003',category:'생산부품',name:'등판내구성 시험기 프레임',type:'반제품',qty:12,unit:'SET',minQty:3,location:'용접장 임시 보관 구역',note:''},
  {id:'INV-004',category:'완제품',name:'좌판시험기 완제품',type:'완제품',qty:2,unit:'대',minQty:0,location:'출하 완제품 대기 구역',note:''},
  {id:'INV-005',category:'사무비품',name:'A4 복사용지',type:'소모품',qty:8,unit:'BOX',minQty:5,location:'사무동 비품 캐비닛',note:'2500매/BOX'},
  {id:'INV-006',category:'사무비품',name:'토너 (흑백 프린터)',type:'소모품',qty:2,unit:'EA',minQty:3,location:'사무동 비품 캐비닛',note:'안전재고 미달'}
];

// 로컬 스토리지 키 관리 및 복구
/* ════════ 저장소 ════════ */
function loadStorage(key, defaultVal) {
  const raw = localStorage.getItem('mes_' + key);
  return raw ? JSON.parse(raw) : defaultVal;
}

function saveStorage(key, data) {
  localStorage.setItem('mes_' + key, JSON.stringify(data));
  _triggerAutoSave();
  if (typeof cloudQueueSave === 'function') cloudQueueSave(key);   // 클라우드 동기화(활성 시)
}

/* 파일에 내장된 데이터를 localStorage로 로드 (파일 열 때 한 번만 실행) */
function initFromEmbedded() {
  const el = document.getElementById('embedded-data');
  if (!el) return;
  try {
    const data = JSON.parse(el.textContent);
    if (!data || typeof data !== 'object') return;
    const keyMap = {
      clients:'clients', products:'products', materials:'materials',
      workOrders:'workOrders', workers:'workers', defects:'defects',
      claims:'claims', checkRecords:'checkRecords', alerts:'alerts',
      inventory:'inventory', deliveries:'deliveries', stages:'stages', trash:'trash',
      rfqList:'rfqList', poList:'poList', partners:'partners',
      financeData:'financeData', attendance:'attendance', leaves:'leaves',
      statementList:'statementList', taxList:'taxList',
      quoteList:'quoteList', orderList:'orderList',
      inventoryLedger:  'inventoryLedger',
      alimtalkSettings: 'alimtalkSettings'
    };
    // 내장 데이터 타임스탬프가 localStorage보다 최신이면 덮어쓰기
    const embeddedTime = data._savedAt || '';
    const localTime    = localStorage.getItem('mes__savedAt') || '';
    if (embeddedTime > localTime || !localTime) {
      Object.entries(keyMap).forEach(([embKey, lsKey]) => {
        if (data[embKey] != null) localStorage.setItem('mes_' + lsKey, JSON.stringify(data[embKey]));
      });
      if (embeddedTime) localStorage.setItem('mes__savedAt', embeddedTime);
    }
  } catch(e) {
    console.warn('내장 데이터 로드 실패:', e);
  }
}

// 앱 시작 전 내장 데이터 우선 로드
initFromEmbedded();

// 잘못 등록된 데이터 자동 정리
(function cleanupBadData() {
  const raw = localStorage.getItem('mes_clients');
  if (!raw) return;
  try {
    const arr = JSON.parse(raw);
    const cleaned = arr.filter(c => c.name !== '234234234' && c.name && c.name.trim());
    if (cleaned.length !== arr.length) {
      localStorage.setItem('mes_clients', JSON.stringify(cleaned));
    }
  } catch(e) {}
})();

/* 전체 변수 재로드 */
function reloadAllData() {
  clients      = loadStorage('clients',      defaultClients);
  products     = loadStorage('products',     defaultProducts);
  materials    = loadStorage('materials',    defaultMaterials);
  materials.forEach(m => { if (m.status === '발주') m.status = '발주중'; });
  workOrders   = loadStorage('workOrders',   defaultWorkOrders);
  workers      = loadStorage('workers',      defaultWorkers);
  defects      = loadStorage('defects',      defaultDefects);
  claims       = loadStorage('claims',       defaultClaims);
  checkRecords = loadStorage('checkRecords', defaultCheckRecords);
  alertsList   = loadStorage('alerts',       defaultAlerts);
  inventory    = loadStorage('inventory',    defaultInventory);
  inventoryLedger  = loadStorage('inventoryLedger', []);
  alimtalkSettings = loadStorage('alimtalkSettings', {
    enabled: false,
    apiKey: '',
    apiSecret: '',
    pfId: '',
    senderPhone: '',
    events: {
      materialIncoming: true,
      deliveryDue: true,
      asRegistered: true,
      poSent: true
    }
  });
  migrateInvCategory();
  deliveries   = loadStorage('deliveries',   []);
  processStages= loadStorage('stages',       ['설계/도면','자재발주','가공/제작','조립','배선/전기','검사/시험','완료','납품']);
  trash        = loadStorage('trash',        []);
  rfqList      = loadStorage('rfqList',      defaultRfqList);
  poList       = loadStorage('poList',       defaultPoList);
  partners     = loadStorage('partners',     defaultPartners);
  statementList= loadStorage('statementList', defaultStatementList);
  taxList      = loadStorage('taxList',       defaultTaxList);
  quoteList    = loadStorage('quoteList',     defaultQuoteList);
  orderList    = loadStorage('orderList',     defaultOrderList);
  if (typeof repairSalesOrderClients === 'function') repairSalesOrderClients();
  financeData  = loadStorage('financeData',  { entries: [], paidReceivable: {}, paidPayable: {} });
  if (!financeData.entries) financeData.entries = [];
  if (!financeData.paidReceivable) financeData.paidReceivable = {};
  if (!financeData.paidPayable) financeData.paidPayable = {};
  attendance   = loadStorage('attendance',   []);
  leaves       = loadStorage('leaves',       []);

  // 자동 마이그레이션: 구형 예시 데이터만 존재하거나 비어있을 시 5개 추가 데이터 자동 삽입
  if (partners.length <= 10) {
    partners = defaultPartners;
    saveStorage('partners', partners);
  }
  if (rfqList.length <= 4) {
    rfqList = defaultRfqList;
    saveStorage('rfqList', rfqList);
  }
  if (poList.length <= 4) {
    poList = defaultPoList;
    saveStorage('poList', poList);
  }
  processStages = processStages.filter(s => s !== '출하완료');
  if (!processStages.includes('완료')) processStages.splice(Math.max(0,processStages.indexOf('납품')),0,'완료');
  if (!processStages.includes('납품')) processStages.push('납품');
  products.forEach(p => { if (p.processStage==='출하완료') { p.processStage='완료'; p.status='완료'; } });
}

/* ════════ 자동 저장 시스템 (IndexedDB 파일 핸들 유지) ════════ */
let _fileHandle    = null;
let _autoSaveTimer = null;

function _storeHandle(h) {
  return new Promise(res => {
    const r = indexedDB.open('MESPro_fh', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('fh');
    r.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('fh', 'readwrite');
      tx.objectStore('fh').put(h, 'handle');
      tx.oncomplete = () => { db.close(); res(); };
    };
    r.onerror = () => res();
  });
}

function _loadHandle() {
  return new Promise(res => {
    const r = indexedDB.open('MESPro_fh', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('fh');
    r.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('fh', 'readonly');
      const g  = tx.objectStore('fh').get('handle');
      g.onsuccess = () => { db.close(); res(g.result || null); };
      g.onerror   = () => { db.close(); res(null); };
    };
    r.onerror = () => res(null);
  });
}

function _showSaveBanner(type) {
  document.getElementById('save-banner')?.remove();
  if (type === 'hidden') return;
  const banner = document.createElement('div');
  banner.id = 'save-banner';
  banner.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:var(--bg-i);border:1px solid var(--br-i);border-radius:var(--rl);padding:12px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.18);font-size:12px;color:var(--tx-i);';
  if (type === 'ask') {
    banner.innerHTML = `<i class="ti ti-device-floppy" style="font-size:20px;"></i>
      <div><div style="font-weight:700;margin-bottom:2px;">자동 저장 설정 (최초 1회)</div>
      <div style="font-size:11px;color:var(--tx-s);">이 파일을 선택하면 변경 시 자동 저장됩니다</div></div>
      <button onclick="connectFile()" style="background:var(--tx-i);color:#fff;border:none;border-radius:var(--rm);padding:5px 14px;cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap;">파일 연결</button>
      <button onclick="document.getElementById('save-banner').remove()" style="background:none;border:none;cursor:pointer;color:var(--tx-t);font-size:20px;line-height:1;">×</button>`;
  } else if (type === 'renew') {
    banner.innerHTML = `<i class="ti ti-refresh" style="font-size:20px;"></i>
      <span>저장 권한을 갱신해 주세요</span>
      <button onclick="_renewPermission()" style="background:var(--tx-i);color:#fff;border:none;border-radius:var(--rm);padding:5px 14px;cursor:pointer;font-size:12px;font-weight:700;">권한 허용</button>
      <button onclick="document.getElementById('save-banner').remove()" style="background:none;border:none;cursor:pointer;color:var(--tx-t);font-size:20px;line-height:1;">×</button>`;
  } else if (type === 'ok') {
    banner.style.background = 'var(--bg-ok)';
    banner.style.borderColor = 'var(--br-ok)';
    banner.style.color = 'var(--tx-ok)';
    banner.innerHTML = '<i class="ti ti-circle-check" style="font-size:20px;"></i><span><b>자동 저장 활성화!</b> 변경 시 파일에 자동 저장됩니다</span>';
    setTimeout(() => banner.remove(), 3500);
  }
  document.body.appendChild(banner);
}

function _buildHTML() {
  const now = new Date().toISOString();
  localStorage.setItem('mes__savedAt', now);
  // 데이터는 더 이상 HTML에 굽지 않는다. 실데이터는 Firebase + mes-data.json이 담당.
  // 배포물(HTML)에 데이터가 들어가지 않도록 embedded-data는 항상 빈 객체.
  const payload = '{}';
  let html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  const O = '<script id="embedded-data" type="application/json">';
  const C = '<' + '/script>';
  html = html.includes('id="embedded-data"')
    ? html.replace(/<script id="embedded-data"[^>]*>[\s\S]*?<\/script>/, O + payload + C)
    : html.replace('</head>', O + payload + C + '\n</head>');
  return html;
}

async function _writeFile() {
  if (!_fileHandle) return;
  try {
    const perm = await _fileHandle.queryPermission({ mode: 'readwrite' });
    if (perm === 'prompt') { _showSaveBanner('renew'); return; }
    if (perm !== 'granted') return;
    const w = await _fileHandle.createWritable();
    await w.write(_buildHTML());
    await w.close();
  } catch(e) { console.warn('자동 저장 실패:', e); }
}

function _triggerAutoSave() {
  if (!_fileHandle) return;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(_writeFile, 1500);
}

async function _renewPermission() {
  if (!_fileHandle) return;
  try {
    const p = await _fileHandle.requestPermission({ mode: 'readwrite' });
    if (p === 'granted') { document.getElementById('save-banner')?.remove(); await _writeFile(); }
  } catch(e) {}
}

async function connectFile() {
  if (!('showOpenFilePicker' in window)) {
    showToast('Chrome 또는 Edge 브라우저에서만 지원됩니다.', 'error'); return;
  }
  try {
    [_fileHandle] = await window.showOpenFilePicker({
      types: [{ description: 'MES Pro HTML', accept: { 'text/html': ['.html'] } }]
    });
    await _storeHandle(_fileHandle);
    await _writeFile();
    _showSaveBanner('ok');
  } catch(e) {
    if (e.name !== 'AbortError') showToast('파일 연결 실패: ' + e.message, 'error');
  }
}

async function initAutoSave() {
  if (cloudConfigured()) return;   // 클라우드 모드: 데이터가 Firestore에 저장되므로 파일 자동저장 불필요
  if (!('showOpenFilePicker' in window)) return;
  const handle = await _loadHandle();
  if (!handle) { setTimeout(() => _showSaveBanner('ask'), 1500); return; }
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') { _fileHandle = handle; return; }
    if (perm === 'prompt')  { _fileHandle = handle; setTimeout(() => _showSaveBanner('renew'), 1000); }
  } catch(e) { setTimeout(() => _showSaveBanner('ask'), 1500); }
}

function saveAsFile() {
  if (_fileHandle) { _writeFile(); return; }
  const blob = new Blob([_buildHTML()], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'MESPro.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('파일이 다운로드되었습니다.', 'success');
}

/* ════════ 전체 데이터 JSON 파일 내보내기/가져오기 (프로그램 ↔ 데이터 분리) ════════ */
const DATA_KEYS = [
  'clients','products','materials','workOrders','workers','defects','claims',
  'checkRecords','alerts','inventory','deliveries','stages','trash','rfqList',
  'poList','partners','financeData','attendance','leaves','statementList',
  'taxList','quoteList','orderList','inventoryLedger','alimtalkSettings'
];

function exportDataJSON() {
  const out = { _savedAt: new Date().toISOString() };
  DATA_KEYS.forEach(k => {
    const raw = localStorage.getItem('mes_' + k);
    if (raw != null) {
      try { out[k] = JSON.parse(raw); } catch(e) { /* 손상 키는 건너뜀 */ }
    }
  });
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mes-data-${today().replace(/-/g,'')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('데이터 파일(mes-data.json) 내보내기 완료', 'success');
}

function importDataJSON(input) {
  const file = input.files[0];
  if (!file) return;
  confirm_('데이터 파일 가져오기',
    `<strong>${file.name}</strong> 파일을 불러옵니다.<br>
    <span style="color:var(--tx-d); font-size:12px;">⚠ 현재 저장된 모든 데이터가 파일의 내용으로 교체됩니다.</span>`,
    () => {
      const reader = new FileReader();
      reader.onload = e => {
        let data;
        try { data = JSON.parse(e.target.result); }
        catch(err) { showToast('JSON 파싱 실패: ' + err.message, 'error'); return; }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          showToast('올바른 데이터 파일이 아닙니다.', 'error'); return;
        }
        let applied = 0;
        DATA_KEYS.forEach(k => {
          if (data[k] != null) {
            localStorage.setItem('mes_' + k, JSON.stringify(data[k]));
            applied++;
            if (typeof cloudQueueSave === 'function') cloudQueueSave(k);
          }
        });
        localStorage.setItem('mes__savedAt', new Date().toISOString());
        reloadAllData();
        if (typeof _goTo === 'function') _goTo(currentPage || 'dashboard', null);
        showToast(`데이터 가져오기 완료 — ${applied}개 항목 복원`, 'success');
      };
      reader.readAsText(file);
    });
  input.value = '';
}

/* ════════ XLS 전체 데이터 내보내기 ════════ */
function exportAllXLS() {
  if (typeof XLSX === 'undefined') {
    showToast('SheetJS 라이브러리 로딩 중입니다. 잠시 후 다시 시도해주세요.', 'error');
    return;
  }

  const wb = XLSX.utils.book_new();

  // 각 데이터셋 → 시트 정의
  const sheets = [
    { name: '고객사', data: clients, cols: ['id','name','manager','tel','email','date','note','closed','closedAt'] },
    { name: '제품', data: products, cols: ['id','clientId','name','spec','qty','unit','price','deliveryDate','processStage','status','processMemo','note'] },
    { name: '자재', data: materials, cols: ['id','productId','name','supplier','unitPrice','qty','unit','orderDate','expectedDate','status','note'] },
    { name: '생산지시', data: workOrders, cols: ['id','clientId','productId','line','qty','done','defect','start','due','status','manager','note'] },
    { name: '작업원', data: workers, cols: ['id','name','line','role','tin','tout','ot','status'] },
    { name: '불량현황', data: defects, cols: ['id','productId','type','stage','qty','date','status','cause','action','note'] },
    { name: '클레임', data: claims, cols: ['id','clientId','productId','date','content','status','action','note'] },
    { name: '검사기록', data: checkRecords, cols: ['id','clientId','productId','date','inspector','visual','dim','func','result','note'] },
    { name: '재고', data: inventory, cols: ['id','name','type','unit','qty','minQty','location','note'] },
    { name: '납품현황', data: deliveries, cols: ['id','deliveredAt','clientId','productId','productName','spec','qty','unit','price','note'] },
    { name: '알림', data: alertsList, cols: ['type','title','sub','createdAt'] },
    { name: '공정단계설정', data: processStages.map((s,i) => ({ 순서: i+1, 단계명: s })), cols: ['순서','단계명'] },
  ];

  sheets.forEach(({ name, data, cols }) => {
    if (!data || !data.length) {
      // 빈 시트도 헤더는 유지
      const ws = XLSX.utils.aoa_to_sheet([cols]);
      XLSX.utils.book_append_sheet(wb, ws, name);
      return;
    }
    // 컬럼 순서를 정의대로 맞춰 배열로 변환
    const rows = data.map(row => cols.map(c => row[c] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);

    // 컬럼 너비 자동 조정
    ws['!cols'] = cols.map(c => ({ wch: Math.max(c.length + 2, 12) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  const fileName = `MESPro_데이터_${today().replace(/-/g,'')}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast(`${fileName} 저장 완료 — ${sheets.length}개 시트`, 'success');
}

/* ════════ XLS 전체 데이터 가져오기 ════════ */
function importAllXLS(input) {
  const file = input.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    showToast('SheetJS 라이브러리가 로드되지 않았습니다.', 'error');
    return;
  }

  confirm_('XLS 데이터 가져오기',
    `<strong>${file.name}</strong> 파일을 불러옵니다.<br>
    <span style="color:var(--tx-d); font-size:12px;">⚠ 현재 저장된 모든 데이터가 파일의 내용으로 교체됩니다.</span>`,
    () => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });

          const readSheet = (name, keyMap) => {
            const ws = wb.Sheets[name];
            if (!ws) return null;
            const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
            return rows;
          };

          // 각 시트 → 데이터 배열로 복원
          const imported = {
            clients:      readSheet('고객사'),
            products:     readSheet('제품'),
            materials:    readSheet('자재'),
            workOrders:   readSheet('생산지시'),
            workers:      readSheet('작업원'),
            defects:      readSheet('불량현황'),
            claims:       readSheet('클레임'),
            checkRecords: readSheet('검사기록'),
            inventory:    readSheet('재고'),
            deliveries:   readSheet('납품현황'),
            alerts:       readSheet('알림'),
            stages:       readSheet('공정단계설정'),
          };

          let loaded = 0;

          if (imported.clients)      { clients      = imported.clients;                                        saveStorage('clients', clients);           loaded++; }
          if (imported.products)     { products     = imported.products;                                       saveStorage('products', products);         loaded++; }
          if (imported.materials)    { materials    = imported.materials;                                      saveStorage('materials', materials);       loaded++; }
          if (imported.workOrders)   { workOrders   = imported.workOrders;                                     saveStorage('workOrders', workOrders);     loaded++; }
          if (imported.workers)      { workers      = imported.workers;                                        saveStorage('workers', workers);           loaded++; }
          if (imported.defects)      { defects      = imported.defects;                                        saveStorage('defects', defects);           loaded++; }
          if (imported.claims)       { claims       = imported.claims;                                         saveStorage('claims', claims);             loaded++; }
          if (imported.checkRecords) { checkRecords = imported.checkRecords;                                   saveStorage('checkRecords', checkRecords); loaded++; }
          if (imported.inventory)    { inventory    = imported.inventory;                                      saveStorage('inventory', inventory);       loaded++; }
          if (imported.deliveries)   { deliveries   = imported.deliveries;                                     saveStorage('deliveries', deliveries);     loaded++; }
          if (imported.alerts)       { alertsList   = imported.alerts;                                         saveStorage('alerts', alertsList);         loaded++; }
          if (imported.stages && imported.stages.length) {
            processStages = imported.stages.map(r => r['단계명'] || r['단계'] || '').filter(Boolean);
            if (!processStages.includes('완료')) processStages.push('완료');
            if (!processStages.includes('납품')) processStages.push('납품');
            saveStorage('stages', processStages);
            loaded++;
          }

          // 화면 전체 갱신
          syncFilterDropdowns();
          renderDashboard();
          refreshPage(currentPage);
          updateDlvBadge();
          updateTrashBadge();
          showToast(`가져오기 완료 — ${loaded}개 시트, 총 ${imported.clients?.length||0}개 고객사`, 'success');
        } catch (err) {
          showToast(`파일 오류: ${err.message}`, 'error');
          console.error('XLS import error:', err);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  );

  // 파일 input 초기화 (같은 파일 재선택 가능하게)
  input.value = '';
}

let clients = loadStorage('clients', defaultClients);
let products = loadStorage('products', defaultProducts);
let materials = loadStorage('materials', defaultMaterials);
let workOrders = loadStorage('workOrders', defaultWorkOrders);
let workers = loadStorage('workers', defaultWorkers);
let defects = loadStorage('defects', defaultDefects);
let claims = loadStorage('claims', defaultClaims);
let checkRecords = loadStorage('checkRecords', defaultCheckRecords);
let alertsList = loadStorage('alerts', defaultAlerts);
let inventory = loadStorage('inventory', defaultInventory);
/* 재고 구분(category) 자동 이관: 구버전 데이터 보정 */
function migrateInvCategory() {
  let changed = false;
  inventory.forEach(i => {
    if (!i.category) { i.category = (i.type === '완제품') ? '완제품' : '생산부품'; changed = true; }
  });
  if (changed) saveStorage('inventory', inventory);
}
migrateInvCategory();
let processStages = loadStorage('stages', ['설계/도면','자재발주','가공/제작','조립','배선/전기','검사/시험','완료','납품']);
// 마이그레이션: '출하완료' → '완료' 통일 및 새 단계 추가
// '출하완료' 단계 제거 (완료로 통일)
processStages = processStages.filter(s => s !== '출하완료');
if (!processStages.includes('완료')) processStages.splice(Math.max(0, processStages.indexOf('납품')), 0, '완료');
if (!processStages.includes('납품')) processStages.push('납품');
saveStorage('stages', processStages);
// 기존 제품 데이터 마이그레이션
const needsMigration = products.some(p => ['완료','납품'].includes(p.processStage));
if (needsMigration) {
  products.forEach(p => { if (p.processStage === '출하완료') { p.processStage = '완료'; p.status = '완료'; } });
  saveStorage('products', products);
}

let trash = loadStorage('trash', []);
let deliveries = loadStorage('deliveries', []);
/* 고객 A/S · 사후관리 대장 */
const defaultAS = [
  {id:'AS-001', clientId:'CL-001', productName:'등판내구성 시험기', recvDate:'2026-05-12', symptom:'서보모터 과열 알람 발생', warranty:'보증', status:'처리중', owner:'E-003', action:'드라이버 교체 후 부하시험 진행 중', doneDate:'', cost:0, note:''},
  {id:'AS-002', clientId:'CL-002', productName:'높이조절 내구성 시험기', recvDate:'2026-04-28', symptom:'리니어 가이드 소음', warranty:'보증', status:'완료', owner:'E-001', action:'가이드 재정렬 및 그리스 보충 완료', doneDate:'2026-05-02', cost:0, note:'정기점검 권고'},
  {id:'AS-003', clientId:'CL-001', productName:'좌판시험기', recvDate:'2026-05-20', symptom:'PLC 통신 단절(보증기간 경과)', warranty:'유상', status:'접수', owner:'', action:'', doneDate:'', cost:350000, note:''},
];
let asList = loadStorage('asList', defaultAS);
/* BOM · 자재명세 — 제품 1대당 소요 자재/수량(레시피). 구매(materials)와 분리된 설계 기준. */
const defaultBom = [
  {id:'BM-001', productId:'PR-001', name:'각파이프 40×40×2T', spec:'SS400', qtyPer:12, unit:'M',  unitPrice:15000,  supplier:'동국제강'},
  {id:'BM-002', productId:'PR-001', name:'볼스크류 SFU1605',  spec:'1605',  qtyPer:2,  unit:'EA', unitPrice:85000,  supplier:'삼익THK'},
  {id:'BM-003', productId:'PR-001', name:'LM가이드 MGN12H',   spec:'MGN12H',qtyPer:4,  unit:'EA', unitPrice:32000,  supplier:'삼익THK'},
  {id:'BM-004', productId:'PR-001', name:'서보모터 200W',     spec:'200W',  qtyPer:1,  unit:'EA', unitPrice:185000, supplier:'LS산전'},
  {id:'BM-005', productId:'PR-002', name:'각파이프 50×50×3T', spec:'SS400', qtyPer:8,  unit:'M',  unitPrice:22000,  supplier:'동국제강'},
  {id:'BM-006', productId:'PR-002', name:'유압실린더 50×150', spec:'50×150',qtyPer:1,  unit:'EA', unitPrice:125000, supplier:'진영유압'},
  {id:'BM-007', productId:'PR-002', name:'PLC 미쯔비시 FX3U', spec:'FX3U',  qtyPer:1,  unit:'EA', unitPrice:320000, supplier:'미쯔비시전기'},
];
let bomList = loadStorage('bomList', defaultBom);
let bomProductId = '';   // BOM 화면에서 선택된 제품
let financeData = loadStorage('financeData', { entries: [], paidReceivable: {}, paidPayable: {} });
// 구조 보정 (구버전 호환)
if (!financeData.entries) financeData.entries = [];
if (!financeData.paidReceivable) financeData.paidReceivable = {};
if (!financeData.paidPayable) financeData.paidPayable = {};
let attendance = loadStorage('attendance', []);
let leaves = loadStorage('leaves', []);

rfqList = loadStorage('rfqList', defaultRfqList);
poList = loadStorage('poList', defaultPoList);
partners = loadStorage('partners', defaultPartners);
let statementList = loadStorage('statementList', defaultStatementList);
let taxList = loadStorage('taxList', defaultTaxList);
let quoteList = loadStorage('quoteList', defaultQuoteList);
let orderList = loadStorage('orderList', defaultOrderList);
/* 수주 전환 고아 제품 복구: 제품의 clientId가 실제 고객사에 없으면 수주 정보로 고객사 자동 생성·연결 */
function repairSalesOrderClients() {
  let cChanged = false, pChanged = false, oChanged = false;
  orderList.forEach(o => {
    const p = o.productId ? products.find(x => x.id === o.productId) : null;
    if (!p) return;
    if (clients.some(c => c.id === p.clientId)) return; // 이미 유효
    const name = (o.clientName || (o.clientId && getClientName(o.clientId)) || p.clientId || '미지정 고객사').trim();
    let ex = clients.find(c => c.name === name);
    let cid;
    if (ex) cid = ex.id;
    else {
      cid = nextCode('CL', clients);
      clients.push({ id: cid, name, manager:'', tel:'', email: o.clientEmail||'', date: today(), note: '수주 전환 고객사 복구' });
      cChanged = true;
    }
    p.clientId = cid; o.clientId = cid; pChanged = true; oChanged = true;
  });
  if (cChanged) saveStorage('clients', clients);
  if (pChanged) saveStorage('products', products);
  if (oChanged) saveStorage('orderList', orderList);
}
repairSalesOrderClients();

// 마이그레이션: 구형 예시 데이터만 존재하거나 비어있을 시 5개 추가 데이터 자동 삽입
if (partners.length <= 10) {
  partners = defaultPartners;
  saveStorage('partners', partners);
}
if (rfqList.length <= 4) {
  rfqList = defaultRfqList;
  saveStorage('rfqList', rfqList);
}
if (poList.length <= 4) {
  poList = defaultPoList;
  saveStorage('poList', poList);
}

/**
 * 재고 입출고/조정 이력 기록
 * @param {string} invId - 재고 품목 ID
 * @param {'입고'|'출고'|'조정'} type
 * @param {number} qty - 변동 수량 (양수)
 * @param {string} reason - 사유 텍스트
 * @param {string} [refId] - 연관 ID (자재발주 MT-xxx 등)
 */
function logInventoryMove(invId, type, qty, reason, refId) {
  const entry = {
    id: 'ILG-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    invId,
    type,
    qty: Number(qty),
    reason: reason || '',
    refId: refId || '',
    date: today()
  };
  inventoryLedger.unshift(entry);
  saveStorage('inventoryLedger', inventoryLedger);
}
