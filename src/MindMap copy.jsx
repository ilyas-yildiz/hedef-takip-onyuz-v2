import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactFlow, { ReactFlowProvider, Controls, Background, Handle, Position, useNodesState, useEdgesState, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';

// === BİLEŞEN 1: HEDEF FORMU MODALI ===
function GoalFormModal({ modalInfo, onSave, onCancel }) {
  // ... (Bu bileşenin kodu öncekiyle aynı, değişiklik yok)
}

// === BİLEŞEN 2: ÖZEL HEDEF DÜĞÜMÜ ===
const GoalNode = ({ data }) => {
    // ... (Bu bileşenin kodu öncekiyle aynı, değişiklik yok)
};

const nodeTypes = { goal: GoalNode };

// === YARDIMCI FONKSİYON: Yerleşim Algoritması ===
function transformToGoalsToFlow(goalsData, collapsedNodes, callbacks) {
    // ... (Bu fonksiyonun kodu öncekiyle aynı, değişiklik yok)
}

// === ANA HARİTA BİLEŞENİ ===
function MindMapInternal() {
  const { projectId } = useParams();
  const [token] = useState(localStorage.getItem('api_token'));
  const [allGoals, setAllGoals] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [modalInfo, setModalInfo] = useState(null);
  const { fitView } = useReactFlow();
  const [collapsedNodes, setCollapsedNodes] = useState(null);
  const isInitialLoad = useRef(true);

  const fetchGoals = useCallback(() => {
    if (!token || !projectId) return;
    fetch(`http://localhost/api/v1/goals/${projectId}`, { headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` } })
    .then(res => res.json())
    .then(data => { setAllGoals(data || []); })
    .catch(error => console.error("Hedefleri çekerken hata:", error));
  }, [token, projectId]);

  const handleStatusChange = useCallback((goalId, newStatus) => {
    fetch(`http://localhost/api/v1/goals/${goalId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ status: newStatus }),})
    .then(res => { if (!res.ok) throw new Error('Durum güncellenemedi.'); fetchGoals(); })
    .catch(error => console.error(error));
  }, [token, fetchGoals]);

  const handleToggleNode = useCallback((nodeId) => {
    isInitialLoad.current = false;
    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      const nodeIdStr = nodeId.toString();
      if (newSet.has(nodeIdStr)) newSet.delete(nodeIdStr); else newSet.add(nodeIdStr);
      return newSet;
    });
  }, []);

  const handleShowAddForm = useCallback((parentId, goalType) => {
    setModalInfo({ mode: 'add', parentId, goalType });
  }, []);
  
  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);
  
  useEffect(() => {
    if (allGoals.length > 0 && isInitialLoad.current && collapsedNodes === null) {
        isInitialLoad.current = false;
        const rootGoal = allGoals[0];
        if (!rootGoal?.children?.length) { setCollapsedNodes(new Set()); return; }
        
        const currentDate = new Date();
        const currentDateString = currentDate.toISOString().split('T')[0]; // "YYYY-MM-DD" formatı
        const activePathIds = new Set([rootGoal.id.toString()]);
        let focusNode = rootGoal;
        
        const activeYear = rootGoal.children.find(y => currentDateString >= y.start_date && currentDateString <= y.end_date);
        if (activeYear) {
            activePathIds.add(activeYear.id.toString());
            const activeMonth = activeYear.children?.find(m => new Date(m.start_date).getFullYear() === currentDate.getFullYear() && new Date(m.start_date).getMonth() === currentDate.getMonth());
            if (activeMonth) {
                activePathIds.add(activeMonth.id.toString());
                // find active day by start_date
                const activeDay = activeMonth.children?.flatMap(w => w.children).find(d => d.start_date === currentDateString);
                if (activeDay) {
                    activePathIds.add(activeDay.id.toString());
                    // Find the parent week of the active day
                    const activeWeek = activeMonth.children.find(w => w.children.some(d => d.id === activeDay.id));
                    if (activeWeek) activePathIds.add(activeWeek.id.toString());
                    focusNode = activeDay;
                } else { focusNode = activeMonth; }
            } else { focusNode = activeYear; }
        }
        
        const initialCollapsed = new Set();
        const findCollapsible = (goals) => {
            for (const goal of goals) {
                if (goal.children?.length > 0) {
                    if (!activePathIds.has(goal.id.toString())) {
                        initialCollapsed.add(goal.id.toString());
                    } else {
                        findCollapsible(goal.children);
                    }
                }
            }
        };
        findCollapsible(allGoals);
        setCollapsedNodes(initialCollapsed);
        
        setTimeout(() => {
            fitView({ nodes: [{ id: focusNode.id.toString() }], duration: 1200, maxZoom: 1.5 });
        }, 200);
    }
  }, [allGoals, fitView, collapsedNodes]);

  useEffect(() => {
      if (collapsedNodes === null) return;
      const callbacks = { onShowAddForm: handleShowAddForm, onToggleNode: handleToggleNode, onStatusChange: handleStatusChange };
      const { nodes, edges } = transformToGoalsToFlow(allGoals, collapsedNodes, callbacks);
      setNodes(nodes);
      setEdges(edges);
  }, [allGoals, collapsedNodes, handleShowAddForm, handleToggleNode, handleStatusChange, setNodes, setEdges]);
  
  useEffect(() => {
    if (!isInitialLoad.current) {
        setTimeout(() => { fitView({ duration: 600, padding: 0.2 }); }, 200);
    }
  }, [collapsedNodes, fitView]);
  
  const handleSaveGoal = (title) => { /* ... */ };
  const onNodeDoubleClick = (event, node) => { setModalInfo({ mode: 'edit', goal: node.data }); };
  
  return (
    <div className="card">
      <Link to="/" style={{/*...*/}}>&larr; Projelerime Dön</Link>
      <button onClick={() => { /*...*/ }} style={{/*...*/}}>Çıkış Yap</button>
      <h1>{allGoals.length > 0 ? allGoals[0].title : "Hedef Haritası"}</h1>
      <hr />
      <div className="org-chart">
        {nodes.length > 0 ? ( <ReactFlow /*...*/ /> ) : ( <h2>Proje Yükleniyor...</h2> )}
      </div>
      {modalInfo && <GoalFormModal /*...*/ />}
    </div>
  );
}

// === UYGULAMA SARICI ===
export default function MindMap() {
    return ( <ReactFlowProvider> <MindMapInternal /> </ReactFlowProvider> );
}