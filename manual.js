const MANUAL_CONTENT = {
  ko: {
    title: '사용 설명서',
    subtitle: 'Adam_Choi 컨테이너 선적 시뮬레이터 기본 사용 흐름',
    back: '← 시뮬레이터',
    toc: '목차',
    sections: [
      {
        title: '1. 기본 흐름',
        body: [
          '컨테이너 대수를 설정하고, 제품 정보를 입력한 뒤 적재 시뮬레이션을 실행합니다.',
          '결과 화면에서 컨테이너별 적재 상태를 확인하고, 필요하면 인쇄/PDF 버튼으로 보고서를 만들 수 있습니다.',
        ],
        list: [
          '① 컨테이너 설정에서 사용할 컨테이너 수량을 입력합니다.',
          '② 제품 입력에서 코드, 제품명, 치수, 중량, 수량을 입력합니다.',
          '필요하면 순번과 구역을 지정합니다.',
          '③ 적재 시뮬레이션 실행 버튼을 누릅니다.',
        ],
      },
      {
        title: '2. 컨테이너 설정',
        body: [
          '20GP, 40GP, 40HC 중 사용할 컨테이너 대수를 입력합니다. 입력한 대수 안에서만 시뮬레이션이 진행됩니다.',
          '적재 효율은 실제 선적 여유 공간을 반영하는 값입니다. 예를 들어 85%로 설정하면 전체 부피의 85%까지만 가용 공간으로 계산합니다.',
        ],
        list: [
          '자동 채우기: 현재 제품 총 CBM 기준으로 필요한 40HC 대수를 자동 입력합니다.',
          '모두 0: 컨테이너 대수를 모두 0으로 초기화합니다.',
        ],
      },
      {
        title: '3. 제품 입력',
        body: [
          '치수는 mm 단위, 중량은 kg 단위로 입력합니다. 수량은 카톤 수량 기준입니다.',
          'CBM/박스와 Total CBM은 입력값을 기준으로 자동 계산됩니다.',
        ],
        list: [
          '순번: 1, 2, 3 순서대로 먼저 적재할 제품을 지정합니다. 자유는 순서 지정 없음입니다.',
          '구역 자유: 특별한 위치 제약 없이 일반 적재합니다.',
          '구역 안쪽: 컨테이너 안쪽의 세로 1 layer를 먼저 채우고 다음 layer로 이동합니다.',
        ],
      },
      {
        title: '4. 엑셀 붙여넣기와 제품 마스터',
        body: [
          '엑셀에서 제품 행을 복사한 뒤 엑셀 붙여넣기 창에 붙여넣을 수 있습니다.',
          '제품 마스터에 코드와 치수가 저장되어 있으면, 코드만 붙여넣어도 치수를 자동으로 채울 수 있습니다.',
        ],
        list: [
          '헤더가 있으면 코드, 제품명, L, W, H, 중량, 수량 열을 자동으로 인식합니다.',
          '헤더가 없으면 왼쪽부터 코드, 제품명, L, W, H, 중량, 수량 순서로 인식합니다.',
          'CSV 가져오기/내보내기로 제품 마스터를 관리할 수 있습니다.',
        ],
      },
      {
        title: '5. 시뮬레이션 결과 확인',
        body: [
          '시뮬레이션이 끝나면 3D 화면에서 컨테이너별 적재 결과를 볼 수 있습니다.',
          '컨테이너가 여러 대이면 컨테이너 선택 드롭다운으로 각 컨테이너의 적재 상태를 확인합니다.',
        ],
        list: [
          'Top, Side, Iso 버튼으로 보기 각도를 바꿀 수 있습니다.',
          '범례에는 현재 컨테이너에 들어간 제품별 수량이 표시됩니다.',
          '미적재 박스가 있으면 컨테이너를 추가하거나 적재 효율을 조정합니다.',
        ],
      },
      {
        title: '6. 저장, 불러오기, 인쇄',
        body: [
          '저장/불러오기 기능으로 자주 쓰는 제품 구성을 브라우저에 저장할 수 있습니다.',
          '인쇄/PDF 버튼은 현재 제품 목록과 시뮬레이션 결과를 고객 제출용 보고서 형태로 출력합니다.',
        ],
        list: [
          '저장 데이터는 현재 사용하는 브라우저의 localStorage에 저장됩니다.',
          '다른 컴퓨터로 옮기려면 CSV 다운로드나 제품 마스터 내보내기를 사용하세요.',
        ],
      },
    ],
  },
  en: {
    title: 'User Manual',
    subtitle: 'Basic workflow for Adam_Choi Container Loading Simulator',
    back: '← Simulator',
    toc: 'Contents',
    sections: [
      {
        title: '1. Basic Workflow',
        body: [
          'Set the container fleet, enter product information, and run the loading simulation.',
          'After the result is generated, review each container in the 3D view and create a print/PDF report if needed.',
        ],
        list: [
          'Set the number of containers in ① Container Settings.',
          'Enter product code, name, dimensions, weight, and quantity in ② Product Mix Input.',
          'Optionally set loading order and zone.',
          'Click Run Simulation.',
        ],
      },
      {
        title: '2. Container Settings',
        body: [
          'Enter the number of 20GP, 40GP, and 40HC containers to use. The simulator will only load within the specified fleet.',
          'Loading efficiency reflects practical unused space. For example, 85% means only 85% of the internal volume is treated as usable.',
        ],
        list: [
          'Auto-fill: calculates the required 40HC count based on the current total CBM.',
          'Clear all: resets all container counts to zero.',
        ],
      },
      {
        title: '3. Product Input',
        body: [
          'Dimensions are entered in millimeters, weight in kilograms, and quantity as carton count.',
          'CBM per carton and total CBM are calculated automatically.',
        ],
        list: [
          'Order: products marked 1, 2, 3 are loaded first in that order. Any means no fixed order.',
          'Zone Any: normal loading with no special position rule.',
          'Zone Nose: fills one vertical layer from the inside/back of the container first, then moves to the next layer.',
        ],
      },
      {
        title: '4. Excel Paste and Product Master',
        body: [
          'Copy product rows from Excel and paste them into the Paste from Excel dialog.',
          'If product dimensions are registered in Product Master, the simulator can fill dimensions automatically from the product code.',
        ],
        list: [
          'With headers, columns such as code, product name, L, W, H, weight, and quantity are mapped automatically.',
          'Without headers, columns are read from left to right as code, name, L, W, H, weight, and quantity.',
          'Use CSV import/export to manage the Product Master.',
        ],
      },
      {
        title: '5. Reviewing Simulation Results',
        body: [
          'After simulation, the 3D viewer shows the loading result for each container.',
          'If multiple containers are used, select a container from the dropdown to inspect it individually.',
        ],
        list: [
          'Use Top, Side, and Iso buttons to change the viewing angle.',
          'The legend shows the product quantities loaded in the currently selected container.',
          'If there are unloaded boxes, add more containers or adjust loading efficiency.',
        ],
      },
      {
        title: '6. Save, Load, and Print',
        body: [
          'Save/Load stores frequently used product mixes in the browser.',
          'Print/PDF creates a customer-ready report with the product list and simulation result.',
        ],
        list: [
          'Saved data is stored in the current browser localStorage.',
          'To move data to another computer, use CSV download or Product Master export.',
        ],
      },
    ],
  },
  vi: {
    title: 'Hướng dẫn sử dụng',
    subtitle: 'Quy trình cơ bản cho trình mô phỏng xếp hàng container',
    back: '← Trình mô phỏng',
    toc: 'Mục lục',
    sections: [
      {
        title: '1. Quy trình cơ bản',
        body: [
          'Thiết lập số lượng container, nhập thông tin sản phẩm, sau đó chạy mô phỏng xếp hàng.',
          'Sau khi có kết quả, kiểm tra từng container trong màn hình 3D và in hoặc lưu PDF nếu cần.',
        ],
        list: [
          'Nhập số lượng container trong ① Cài đặt container.',
          'Nhập mã, tên, kích thước, trọng lượng và số lượng sản phẩm.',
          'Có thể đặt thứ tự xếp và khu vực xếp.',
          'Bấm nút chạy mô phỏng.',
        ],
      },
      {
        title: '2. Cài đặt container',
        body: [
          'Nhập số lượng 20GP, 40GP và 40HC sẽ sử dụng. Chương trình chỉ xếp trong số container đã chỉ định.',
          'Hiệu suất xếp hàng phản ánh khoảng trống thực tế. Ví dụ 85% nghĩa là chỉ dùng 85% thể tích bên trong.',
        ],
        list: [
          'Tự động điền: tính số lượng 40HC cần thiết theo tổng CBM hiện tại.',
          'Xóa tất cả: đặt toàn bộ số lượng container về 0.',
        ],
      },
      {
        title: '3. Nhập sản phẩm',
        body: [
          'Kích thước dùng đơn vị mm, trọng lượng dùng kg, số lượng là số carton.',
          'CBM mỗi carton và tổng CBM được tính tự động.',
        ],
        list: [
          'Thứ tự: 1, 2, 3 sẽ được xếp trước theo đúng thứ tự. Tự do nghĩa là không cố định thứ tự.',
          'Khu vực Tự do: xếp bình thường.',
          'Khu vực Bên trong: lấp đầy một lớp dọc ở phía trong container trước, rồi chuyển sang lớp kế tiếp.',
        ],
      },
      {
        title: '4. Dán từ Excel và Product Master',
        body: [
          'Có thể sao chép các dòng sản phẩm từ Excel và dán vào cửa sổ dán Excel.',
          'Nếu mã và kích thước đã lưu trong Product Master, chương trình có thể tự điền kích thước theo mã.',
        ],
        list: [
          'Nếu có tiêu đề cột, chương trình tự nhận mã, tên, L, W, H, trọng lượng và số lượng.',
          'Nếu không có tiêu đề, thứ tự cột là mã, tên, L, W, H, trọng lượng, số lượng.',
          'Dùng nhập/xuất CSV để quản lý Product Master.',
        ],
      },
      {
        title: '5. Kiểm tra kết quả mô phỏng',
        body: [
          'Sau khi mô phỏng, màn hình 3D hiển thị kết quả xếp hàng cho từng container.',
          'Nếu có nhiều container, dùng danh sách chọn container để kiểm tra từng chiếc.',
        ],
        list: [
          'Dùng Top, Side, Iso để đổi góc nhìn.',
          'Chú giải hiển thị số lượng từng sản phẩm trong container đang chọn.',
          'Nếu còn hàng chưa xếp, hãy thêm container hoặc điều chỉnh hiệu suất xếp.',
        ],
      },
      {
        title: '6. Lưu, tải và in',
        body: [
          'Chức năng lưu/tải lưu cấu hình sản phẩm thường dùng trong trình duyệt.',
          'Nút In/PDF tạo báo cáo gồm danh sách sản phẩm và kết quả mô phỏng.',
        ],
        list: [
          'Dữ liệu lưu nằm trong localStorage của trình duyệt hiện tại.',
          'Muốn chuyển sang máy khác, hãy dùng tải CSV hoặc xuất Product Master.',
        ],
      },
    ],
  },
  zh: {
    title: '用户手册',
    subtitle: 'Adam_Choi 集装箱装载模拟器基本使用流程',
    back: '← 模拟器',
    toc: '目录',
    sections: [
      {
        title: '1. 基本流程',
        body: [
          '先设置集装箱数量，输入产品信息，然后运行装载模拟。',
          '生成结果后，可在 3D 画面中查看每个集装箱，并按需要打印或保存 PDF 报告。',
        ],
        list: [
          '在 ① 集装箱设置中输入要使用的集装箱数量。',
          '在 ② 产品输入中填写代码、名称、尺寸、重量和数量。',
          '可选择设置装载顺序和区域。',
          '点击运行模拟按钮。',
        ],
      },
      {
        title: '2. 集装箱设置',
        body: [
          '输入 20GP、40GP、40HC 的使用数量。模拟器只会在指定的集装箱数量内装载。',
          '装载效率用于反映实际预留空间。例如 85% 表示仅把内部体积的 85% 作为可用空间。',
        ],
        list: [
          '自动填充：根据当前总 CBM 自动计算所需 40HC 数量。',
          '全部清零：将所有集装箱数量设为 0。',
        ],
      },
      {
        title: '3. 产品输入',
        body: [
          '尺寸单位为 mm，重量单位为 kg，数量为 carton 数量。',
          '每箱 CBM 和总 CBM 会自动计算。',
        ],
        list: [
          '顺序：设置为 1、2、3 的产品会按该顺序优先装载。自由表示不指定顺序。',
          '区域自由：无特殊位置限制，正常装载。',
          '区域内侧：先填满集装箱内侧的一层垂直层，再移动到下一层。',
        ],
      },
      {
        title: '4. Excel 粘贴和产品主表',
        body: [
          '可以从 Excel 复制产品行，并粘贴到 Excel 粘贴窗口。',
          '如果产品主表中已保存代码和尺寸，只输入代码也可以自动填充尺寸。',
        ],
        list: [
          '有表头时，自动识别代码、名称、L、W、H、重量、数量等列。',
          '无表头时，按代码、名称、L、W、H、重量、数量的顺序读取。',
          '可通过 CSV 导入/导出管理产品主表。',
        ],
      },
      {
        title: '5. 查看模拟结果',
        body: [
          '模拟完成后，3D 画面会显示每个集装箱的装载结果。',
          '如果使用多个集装箱，可通过下拉菜单逐个查看。',
        ],
        list: [
          'Top、Side、Iso 按钮可切换视角。',
          '图例显示当前集装箱内各产品的装载数量。',
          '如果存在未装载箱数，请增加集装箱或调整装载效率。',
        ],
      },
      {
        title: '6. 保存、读取和打印',
        body: [
          '保存/读取功能会把常用产品组合保存在当前浏览器中。',
          '打印/PDF 按钮会生成包含产品列表和模拟结果的报告。',
        ],
        list: [
          '保存数据存储在当前浏览器的 localStorage 中。',
          '如需移动到其他电脑，请使用 CSV 下载或产品主表导出。',
        ],
      },
    ],
  },
  ja: {
    title: '取扱説明書',
    subtitle: 'Adam_Choi コンテナ積載シミュレーターの基本操作',
    back: '← シミュレーター',
    toc: '目次',
    sections: [
      {
        title: '1. 基本の流れ',
        body: [
          '使用するコンテナ数を設定し、製品情報を入力してから積載シミュレーションを実行します。',
          '結果が出たら 3D 画面で各コンテナを確認し、必要に応じて印刷または PDF レポートを作成します。',
        ],
        list: [
          '① コンテナ設定で使用するコンテナ数を入力します。',
          '② 製品入力でコード、製品名、寸法、重量、数量を入力します。',
          '必要に応じて順番とゾーンを指定します。',
          'シミュレーション実行ボタンを押します。',
        ],
      },
      {
        title: '2. コンテナ設定',
        body: [
          '20GP、40GP、40HC の使用台数を入力します。指定した台数の範囲内でのみ積載します。',
          '積載効率は実際の余裕スペースを反映する値です。85% の場合、内部体積の 85% を利用可能容量として扱います。',
        ],
        list: [
          '自動入力: 現在の総 CBM から必要な 40HC 台数を自動計算します。',
          'すべて 0: コンテナ台数をすべて 0 に戻します。',
        ],
      },
      {
        title: '3. 製品入力',
        body: [
          '寸法は mm、重量は kg、数量はカートン数で入力します。',
          'CBM/箱と合計 CBM は自動計算されます。',
        ],
        list: [
          '順番: 1、2、3 の順で優先積載します。自由は順番指定なしです。',
          'ゾーン自由: 特別な位置制限なしで通常積載します。',
          'ゾーン奥: コンテナ奥側の縦 1 layer を先に埋め、次の layer に移動します。',
        ],
      },
      {
        title: '4. Excel 貼り付けと製品マスター',
        body: [
          'Excel から製品行をコピーし、Excel 貼り付け画面に貼り付けできます。',
          '製品マスターにコードと寸法が登録されていれば、コードだけで寸法を自動補完できます。',
        ],
        list: [
          'ヘッダーがある場合、コード、製品名、L、W、H、重量、数量を自動認識します。',
          'ヘッダーがない場合、左からコード、製品名、L、W、H、重量、数量として読み取ります。',
          'CSV 取込/出力で製品マスターを管理できます。',
        ],
      },
      {
        title: '5. シミュレーション結果の確認',
        body: [
          'シミュレーション後、3D 画面にコンテナごとの積載結果が表示されます。',
          '複数コンテナの場合はドロップダウンで各コンテナを確認します。',
        ],
        list: [
          'Top、Side、Iso ボタンで表示角度を切り替えます。',
          '凡例には現在のコンテナに入った製品別数量が表示されます。',
          '未積載箱がある場合はコンテナを追加するか積載効率を調整します。',
        ],
      },
      {
        title: '6. 保存、読み込み、印刷',
        body: [
          '保存/読み込み機能でよく使う製品構成をブラウザに保存できます。',
          '印刷/PDF ボタンで製品リストとシミュレーション結果を含むレポートを作成します。',
        ],
        list: [
          '保存データは現在のブラウザの localStorage に保存されます。',
          '別の PC に移す場合は CSV ダウンロードまたは製品マスター出力を使用してください。',
        ],
      },
    ],
  },
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function currentManual() {
  return MANUAL_CONTENT[I18N.getLang()] || MANUAL_CONTENT.ko;
}

function renderManual() {
  const data = currentManual();
  document.documentElement.lang = I18N.getLang();
  document.title = `${data.title} | Container Loading Simulator`;
  document.getElementById('manualTitle').textContent = data.title;
  document.getElementById('manualSubtitle').textContent = data.subtitle;
  document.getElementById('backLink').textContent = data.back;

  const toc = document.getElementById('manualToc');
  toc.innerHTML = `<strong>${escapeHtml(data.toc)}</strong>`;
  data.sections.forEach((section, index) => {
    const a = document.createElement('a');
    a.href = `#section-${index + 1}`;
    a.textContent = section.title;
    toc.appendChild(a);
  });

  const content = document.getElementById('manualContent');
  content.innerHTML = data.sections.map((section, index) => `
    <section class="manual-section" id="section-${index + 1}">
      <h2>${escapeHtml(section.title)}</h2>
      ${section.body.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
      ${section.list ? `<ul>${section.list.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
    </section>
  `).join('');
}

function initManualLangSelect() {
  const sel = document.getElementById('manualLangSelect');
  sel.innerHTML = '';
  for (const { code, label } of I18N.LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = label;
    sel.appendChild(opt);
  }

  const params = new URLSearchParams(window.location.search);
  const requested = params.get('lang');
  if (requested && I18N.DICT[requested]) I18N.setLang(requested);

  sel.value = I18N.getLang();
  sel.addEventListener('change', () => {
    I18N.setLang(sel.value);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', sel.value);
    history.replaceState(null, '', url);
  });

  I18N.onChange(lang => {
    if (sel.value !== lang) sel.value = lang;
    renderManual();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initManualLangSelect();
  renderManual();
});
