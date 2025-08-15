import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = "http://localhost:5000";

function App() {
  const [activeTab, setActiveTab] = useState("menu");
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({ totalCount: 0, totalRevenue: 0 });

  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuPrice, setNewMenuPrice] = useState("");
  const [menuOptionInput, setMenuOptionInput] = useState({});

  const [orderForm, setOrderForm] = useState({
    tableNumber: "",
    items: [],
    takeaway: false,
    notes: "",
    extra_charge: 0,
    paid: false,
  });

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchMenus = async () => {
    try { const res = await axios.get(`${API_URL}/menu`); setMenus(res.data || []); }
    catch (err) { console.error(err); }
  };

  const fetchOrdersByDate = async (date) => {
    try {
      const res = await axios.get(`${API_URL}/orders/date/${date}`);
      const ordersData = res.data || [];
      setOrders(ordersData);

      let totalCount = 0;
      let totalRevenue = 0;

      ordersData.forEach(order => {
        const items = order.items || [];
        items.forEach(item => {
          const qty = parseInt(item.quantity) || 1;
          totalCount += qty;
          totalRevenue += (item.base_price || 0) * qty;
        });
        totalRevenue += order.extra_charge || 0;
      });
      setSummary({ totalCount, totalRevenue });

      setCurrentPage(1);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchMenus(); fetchOrdersByDate(selectedDate); }, [selectedDate]);

  const addMenu = async () => {
    if (!newMenuName || newMenuPrice === "") return;
    await axios.post(`${API_URL}/menu`, { name: newMenuName, base_price: parseFloat(newMenuPrice) || 0 });
    setNewMenuName(""); setNewMenuPrice("");
    fetchMenus();
  };

  const deleteMenu = async (id) => {
    if (!window.confirm("确认删除？")) return;
    await axios.delete(`${API_URL}/menu/${id}`);
    fetchMenus();
  };

  const addMenuOption = async (menuId) => {
    const input = menuOptionInput[menuId];
    if (!input || !input.category || !input.option_name) return;
    await axios.post(`${API_URL}/menu/${menuId}/options`, input);
    setMenuOptionInput(prev => ({ ...prev, [menuId]: {} }));
    fetchMenus();
  };

  const deleteMenuOption = async (optionId) => {
    if (!window.confirm("确认删除？")) return;
    await axios.delete(`${API_URL}/menu/options/${optionId}`);
    fetchMenus();
  };

  const addItemToOrder = (menu) => {
    const optionSelections = {};
    menu.options.forEach(opt => { if (!optionSelections[opt.category]) optionSelections[opt.category] = ""; });
    setOrderForm(prev => ({ 
      ...prev, 
      items: [...prev.items, { menuId: menu.id, name: menu.name, base_price: menu.base_price, options: optionSelections, quantity: 1 }] 
    }));
  };

  const handleOptionChange = (itemIndex, category, value, isEditing = false) => {
    const targetItems = isEditing ? [...editingOrderForm.items] : [...orderForm.items];
    targetItems[itemIndex].options[category] = value;
    if (isEditing) setEditingOrderForm(prev => ({ ...prev, items: targetItems }));
    else setOrderForm(prev => ({ ...prev, items: targetItems }));
  };

  const submitOrder = async () => {
    if (!orderForm.tableNumber || orderForm.items.length === 0) return;

    console.log("提交订单:", orderForm);

    try {
      await axios.post(`${API_URL}/orders`, orderForm);
      setOrderForm({ tableNumber: "", items: [], takeaway: false, notes: "", extra_charge: 0, paid: false });
      fetchOrdersByDate(selectedDate);
    } catch (err) {
      console.error(err.response?.data || err);
      alert("提交失败，请检查输入格式");
    }
  };

  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingOrderForm, setEditingOrderForm] = useState({
    tableNumber: "",
    items: [],
    takeaway: false,
    notes: "",
    extra_charge: 0,
    paid: false,
  });

  const startEditingOrder = (order) => {
    setEditingOrderId(order.id);
    setEditingOrderForm({
      tableNumber: order.tableNumber,
      items: order.items.map(it => ({ ...it })),
      takeaway: order.takeaway,
      notes: order.notes,
      extra_charge: order.extra_charge,
      paid: order.paid,
    });
  };

  const changeOrderStatus = async (id, status) => {
    await axios.put(`${API_URL}/orders/${id}/status`, { status });
    fetchOrdersByDate(selectedDate);
  };

  const deleteOrder = async (id) => {
    if (!window.confirm("确认删除？")) return;
    await axios.delete(`${API_URL}/orders/${id}`);
    fetchOrdersByDate(selectedDate);
  };

  const paginatedOrders = orders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="container">
      <div className="top-nav card" style={{ display: "flex", justifyContent: "space-around" }}>
        <button onClick={() => setActiveTab("menu")} className={activeTab === "menu" ? "active" : ""}>菜单管理</button>
        <button onClick={() => setActiveTab("order")} className={activeTab === "order" ? "active" : ""}>下单</button>
        <button onClick={() => setActiveTab("list")} className={activeTab === "list" ? "active" : ""}>订单列表</button>
      </div>

      {activeTab === "menu" && (
        <>
          <h2>菜单管理</h2>
          <div className="card">
            <input placeholder="菜单名称" value={newMenuName} onChange={e => setNewMenuName(e.target.value)} />
            <input type="number" placeholder="价格" value={newMenuPrice} onChange={e => setNewMenuPrice(e.target.value)} />
            <button onClick={addMenu}>新增菜品</button>
          </div>

          {menus.map(menu => (
            <div key={menu.id} className="card">
              <strong>{menu.name}</strong> - {menu.base_price} MYR
              <button onClick={() => deleteMenu(menu.id)}>删除菜单</button>
              <h4>附加选项</h4>
              {menu.options.map(opt => (
                <div key={opt.id}>{opt.category}: {opt.option_name} <button onClick={() => deleteMenuOption(opt.id)}>删除</button></div>
              ))}
              <input placeholder="类别" value={menuOptionInput[menu.id]?.category || ""} onChange={e => setMenuOptionInput(prev => ({ ...prev, [menu.id]: { ...prev[menu.id], category: e.target.value } }))} />
              <input placeholder="选项名" value={menuOptionInput[menu.id]?.option_name || ""} onChange={e => setMenuOptionInput(prev => ({ ...prev, [menu.id]: { ...prev[menu.id], option_name: e.target.value } }))} />
              <button onClick={() => addMenuOption(menu.id)}>新增选项</button>
            </div>
          ))}
        </>
      )}

      {activeTab === "order" && (
        <>
          <h2>下单</h2>
          <div className="order-form card">
            <input placeholder="桌号" value={orderForm.tableNumber} onChange={e => setOrderForm(prev => ({ ...prev, tableNumber: e.target.value }))} />
            <label>
              打包
              <input type="checkbox" checked={orderForm.takeaway} onChange={e => setOrderForm(prev => ({ ...prev, takeaway: e.target.checked }))} />
            </label>
            <label>
              额外收费
              <input type="number" value={orderForm.extra_charge || 0} onChange={e => setOrderForm(prev => ({ ...prev, extra_charge: parseFloat(e.target.value) || 0 }))} placeholder="可填正数或负数" />
            </label>
            <label>
              已付费
              <input type="checkbox" checked={orderForm.paid} onChange={e => setOrderForm(prev => ({ ...prev, paid: e.target.checked }))} />
            </label>
            <textarea placeholder="备注" rows={3} value={orderForm.notes} onChange={e => setOrderForm(prev => ({ ...prev, notes: e.target.value }))} style={{ width: "100%", padding: "5px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box", marginTop: "5px" }} />

            <h3>选择菜品</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
              {menus.map(menu => (
                <button key={menu.id} style={{ padding: '8px 12px', borderRadius: '5px', border: '1px solid #4CAF50', backgroundColor: '#fff', color: '#000', fontWeight: 'bold', cursor: 'pointer', flex: '0 1 auto', minWidth: '70px', textAlign: 'center' }}
                  onClick={() => addItemToOrder(menu)}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#e0f0d9'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  {menu.name || '未命名菜品'}
                </button>
              ))}
            </div>

            <h3>已选菜品</h3>
            {orderForm.items.map((item, idx) => (
              <div key={idx} className="card">
                <strong>{item.name}</strong>
                {Object.keys(item.options).map(cat => (
                  <div key={cat}>
                    {cat}:
                    <select value={item.options[cat]} onChange={e => handleOptionChange(idx, cat, e.target.value)}>
                      <option value="">请选择</option>
                      {menus.find(m => m.id === item.menuId)?.options.filter(o => o.category === cat).map(opt => (
                        <option key={opt.id} value={opt.option_name}>{opt.option_name}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <input type="number" value={item.quantity || 1} onChange={e => { const newItems = [...orderForm.items]; newItems[idx].quantity = parseInt(e.target.value) || 1; setOrderForm(prev => ({ ...prev, items: newItems })); }} placeholder="数量" />
                <button onClick={() => { const newItems = [...orderForm.items]; newItems.splice(idx, 1); setOrderForm(prev => ({ ...prev, items: newItems })); }}>删除菜品</button>
              </div>
            ))}

            <button onClick={submitOrder} style={{ marginTop: "10px" }}>提交订单</button>
          </div>
        </>
      )}

      {activeTab === "list" && (
        <>
          <h2>订单列表</h2>
          <label>
            选择日期:
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          </label>

          <div className="card">
            <div>今日总订单份数: {summary.totalCount}</div>
            <div>今日总收入: {summary.totalRevenue}</div>
          </div>

          {paginatedOrders.map(order => (
            <div key={order.id} className="card">
              <div>
                桌号: {order.tableNumber}, 打包: {order.takeaway ? "是" : "否"}, 状态: {order.status}, 已付费: {order.paid ? "是" : "否"}
                <button onClick={() => changeOrderStatus(order.id, "制作中")}>制作中</button>
                <button onClick={() => changeOrderStatus(order.id, "出餐")}>出餐</button>
                <button onClick={() => deleteOrder(order.id)}>删除</button>
                <button onClick={() => { editingOrderId === order.id ? setEditingOrderId(null) : startEditingOrder(order); }}>
                  {editingOrderId === order.id ? "取消编辑" : "编辑"}
                </button>
              </div>

              {editingOrderId === order.id && (
                <div className="order-edit-form" style={{ marginTop: '10px', padding: '10px', border: '1px dashed #4CAF50' }}>
                  <h4>编辑订单</h4>
                  <input placeholder="桌号" value={editingOrderForm.tableNumber} onChange={e => setEditingOrderForm(prev => ({ ...prev, tableNumber: e.target.value }))} />
                  <label>
                    打包
                    <input type="checkbox" checked={editingOrderForm.takeaway} onChange={e => setEditingOrderForm(prev => ({ ...prev, takeaway: e.target.checked }))} />
                  </label>
                  {editingOrderForm.items.map((item, idx) => (
                    <div key={idx} style={{ border: "1px solid #ccc", margin: 5, padding: 5 }}>
                      <strong>{item.name}</strong>
                      {Object.keys(item.options).map(cat => (
                        <div key={cat}>
                          {cat}:
                          <select value={item.options[cat]} onChange={e => handleOptionChange(idx, cat, e.target.value, true)}>
                            <option value="">请选择</option>
                            {menus.find(m => m.id === item.menuId)?.options.filter(o => o.category === cat).map(opt => (
                              <option key={opt.id} value={opt.option_name}>{opt.option_name}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                      <input type="number" value={item.quantity || 1} onChange={e => { const newItems = [...editingOrderForm.items]; newItems[idx].quantity = parseInt(e.target.value) || 1; setEditingOrderForm(prev => ({ ...prev, items: newItems })); }} placeholder="数量" />
                      <button onClick={() => { const newItems = [...editingOrderForm.items]; newItems.splice(idx, 1); setEditingOrderForm(prev => ({ ...prev, items: newItems })); }}>删除菜品</button>
                    </div>
                  ))}

                  <textarea placeholder="备注" rows={2} value={editingOrderForm.notes} onChange={e => setEditingOrderForm(prev => ({ ...prev, notes: e.target.value }))} style={{ width: "100%", marginTop: "5px" }} />
                  <input type="number" placeholder="额外收费" value={editingOrderForm.extra_charge || 0} onChange={e => setEditingOrderForm(prev => ({ ...prev, extra_charge: parseFloat(e.target.value) || 0 }))} />
                  <label>
                    已付费
                    <input type="checkbox" checked={editingOrderForm.paid} onChange={e => setEditingOrderForm(prev => ({ ...prev, paid: e.target.checked }))} />
                  </label>

                  <button onClick={async () => {
                    try {
                      await axios.put(`${API_URL}/orders/${editingOrderId}`, editingOrderForm);
                      fetchOrdersByDate(selectedDate);
                      setEditingOrderId(null);
                    } catch (err) {
                      alert("修改订单失败，请检查输入格式。");
                    }
                  }}>保存修改</button>
                </div>
              )}

              <div className="order-items">
                菜品:
                {order.items.map((it, i) => (
                  <div key={i}>
                    {it.name} - {Object.entries(it.options).map(([k, v]) => `${k}:${v}`).join(", ")} x{it.quantity || 1}
                  </div>
                ))}
                <div>备注: {order.notes}</div>
                <div>额外金额: {order.extra_charge}</div>
              </div>
            </div>
          ))}

          <div style={{ marginTop: '10px' }}>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>上一页</button>
            <button disabled={currentPage * pageSize >= orders.length} onClick={() => setCurrentPage(p => p + 1)}>下一页</button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
