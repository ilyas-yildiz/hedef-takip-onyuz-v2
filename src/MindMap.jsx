import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactFlow, { ReactFlowProvider, Controls, Background, Handle, Position, useNodesState, useEdgesState, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';

// === BİLEŞEN 1: HEDEF FORMU MODALI ===
function GoalFormModal({ modalInfo, onSave, onCancel }) {
    const [title, setTitle] = useState(modalInfo.goal ? modalInfo.goal.title : '');
    const handleSubmit = (e) => { e.preventDefault(); onSave(title); };
    const goalTypeLabel = modalInfo.goal ? modalInfo.goal.type : modalInfo.goalType;
    const titleText = modalInfo.mode === 'edit' ? `"${modalInfo.goal.title}" Hedefini Düzenle` : `Yeni ${goalTypeLabel} Hedefi Ekle`;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>{titleText}</h2>
                <form onSubmit={handleSubmit}>
                    <div>
                        <label>Hedef Başlığı:</label>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
                    </div>
                    <div className="modal-actions">
                        <button type="button" onClick={onCancel}>İptal</button>
                        <button type="submit">Kaydet</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// === BİLEŞEN 2: ÖZEL HEDEF DÜĞÜMÜ ===
const GoalNode = ({ data }) => {
    const className = `react-flow__node-goal ${data.status === 'completed' ? 'completed' : ''}`;
    const toggleButtonClassName = `toggle-button ${data.isCollapsed ? 'closed' : ''}`;

    let label = '';
    switch (data.type) {
        case 'five_year': label = '5 Yıllık Hedef'; break;
        case 'yearly': label = `${data.index + 1}. Yıl`; break;
        case 'weekly': label = `${data.index + 1}. Hafta`; break;
        case 'daily': break;
        case 'hourly': break;
        default: label = '';
    }

    return (
        <div className={className}>
            <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} isConnectable={false} />
            <input type="checkbox" className="goal-checkbox" checked={data.status === 'completed'} onChange={() => data.onStatusChange(data.id, data.status === 'completed' ? 'pending' : 'completed')} onClick={(e) => e.stopPropagation()} />
            <div style={{ textAlign: 'left', width: '100%', paddingRight: '20px' }}>
                {label && <small style={{ fontWeight: 'bold', color: '#007bff', display: 'block', marginBottom: '4px' }}>{label}</small>}
                <span>{data.title}</span>
            </div>
            {data.childType && (
                <button className="add-child-button" onClick={(e) => { e.stopPropagation(); data.onShowAddForm(); }}>+</button>
            )}
            {data.hasChildren && (
                <div className={toggleButtonClassName} onClick={(e) => { e.stopPropagation(); data.onToggleNode(); }}></div>
            )}
            <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} isConnectable={false} />
        </div>
    );
};

// === YARDIMCI FONKSİYON: Yerleşim Algoritması ===
function transformToGoalsToFlow(goalsData, collapsedNodes, callbacks) {
    const nodesArr = [];
    const edgesArr = [];
    const xOffset = 400;
    const ySpacing = 110;

    function getSubTreeHeight(goal) {
        if (collapsedNodes.has(goal.id.toString()) || !goal.children || goal.children.length === 0) { return ySpacing; }
        let height = 0;
        for (const child of goal.children) { height += getSubTreeHeight(child); }
        return height;
    }

    function layoutTree(goals, parentNode = null, level = 0, startY = 0) {
        let currentY = startY;
        goals.forEach((goal, index) => {
            const subTreeHeight = getSubTreeHeight(goal);
            const xPos = level * xOffset;
            const yPos = currentY + (subTreeHeight / 2) - (ySpacing / 2);
            const goalTypes = { five_year: 'yearly', yearly: 'monthly', monthly: 'weekly', weekly: 'daily', daily: 'hourly', hourly: null };
            const childType = goalTypes[goal.type];
            const hasChildren = goal.children && goal.children.length > 0;
            const node = {
                id: goal.id.toString(), type: 'goal', position: { x: xPos, y: yPos },
                data: { ...goal, index, childType, hasChildren, onShowAddForm: () => callbacks.onShowAddForm(goal.id, childType), onToggleNode: () => callbacks.onToggleNode(goal.id), onStatusChange: callbacks.onStatusChange, isCollapsed: collapsedNodes.has(goal.id.toString()) },
            };
            nodesArr.push(node);
            if (parentNode) {
                edgesArr.push({ id: `e-${parentNode.id}-${goal.id}`, source: parentNode.id.toString(), target: goal.id.toString(), type: 'smoothstep' });
            }
            if (hasChildren && !collapsedNodes.has(goal.id.toString())) {
                layoutTree(goal.children, node, level + 1, currentY);
            }
            currentY += subTreeHeight;
        });
    }

    if (goalsData && goalsData.length > 0) { layoutTree(goalsData); }
    return { nodes: nodesArr, edges: edgesArr };
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

    // DÜZELTME 2: nodeTypes'ı useMemo ile sarmaladık.
    const nodeTypes = useMemo(() => ({ goal: GoalNode }), []);

    const fetchGoals = useCallback(() => {
        if (!token || !projectId) return;
        fetch(`http://localhost/api/v1/goals/${projectId}`, { headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => { setAllGoals(data || []); })
            .catch(error => { console.error("Hedefleri çekerken hata:", error); });
    }, [token, projectId]);

    const handleStatusChange = useCallback((goalId, newStatus) => {
        fetch(`http://localhost/api/v1/goals/${goalId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ status: newStatus }), })
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

            const goalMap = new Map();
            const parentMap = new Map();
            // DÜZELTME 1: buildMap -> buildMaps yazım hatası giderildi.
            const buildMaps = (goals, parentId = null) => {
                for (const goal of goals) {
                    goalMap.set(goal.id, goal);
                    parentMap.set(goal.id, parentId);
                    if (goal.children) buildMaps(goal.children, goal.id);
                }
            };
            buildMaps(allGoals);

            const currentDate = new Date();
            const todayString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

            let activeDay = null;
            for (const goal of goalMap.values()) {
                if (goal.type === 'daily' && goal.start_date === todayString) {
                    activeDay = goal;
                    break;
                }
            }

            let focusNode = rootGoal;
            const activePathIds = new Set();
            if (activeDay) {
                focusNode = activeDay;
                let currentId = activeDay.id;
                while (currentId) {
                    activePathIds.add(currentId.toString());
                    currentId = parentMap.get(currentId);
                }
            }

            const initialCollapsed = new Set();
            for (const goal of goalMap.values()) {
                if (goal.children?.length > 0 && !activePathIds.has(goal.id.toString())) {
                    initialCollapsed.add(goal.id.toString());
                }
            }
            setCollapsedNodes(initialCollapsed);

            setTimeout(() => {
                fitView({ nodes: [{ id: focusNode.id.toString() }], duration: 1200, maxZoom: 1.5 });
            }, 200);
        }
    }, [allGoals, fitView]);

    const memoizedElements = useMemo(() => {
        if (collapsedNodes === null) return { nodes: [], edges: [] };
        const callbacks = { onShowAddForm: handleShowAddForm, onToggleNode: handleToggleNode, onStatusChange: handleStatusChange };
        return transformToGoalsToFlow(allGoals, collapsedNodes, callbacks);
    }, [allGoals, collapsedNodes, handleShowAddForm, handleToggleNode, handleStatusChange]);

    useEffect(() => {
        setNodes(memoizedElements.nodes);
        setEdges(memoizedElements.edges);
    }, [memoizedElements, setNodes, setEdges]);

    useEffect(() => {
        if (!isInitialLoad.current) {
            setTimeout(() => { fitView({ duration: 600, padding: 0.2 }); }, 200);
        }
    }, [collapsedNodes, fitView]);

    const handleSaveGoal = (title) => {
        if (!modalInfo) return;
        const { mode, goal, parentId, goalType } = modalInfo;
        const isEdit = mode === 'edit';
        const url = isEdit ? `http://localhost/api/v1/goals/${goal.id}` : 'http://localhost/api/v1/goals';
        const method = isEdit ? 'PATCH' : 'POST';
        const body = isEdit ? { title } : { title, type: goalType, parent_id: parentId };
        fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) })
            .then(res => { if (!res.ok) { res.json().then(err => console.error("API Kaydetme Hatası:", err)); throw new Error('İşlem başarısız'); } return res.json(); })
            .then(() => { fetchGoals(); })
            .catch(console.error)
            .finally(() => setModalInfo(null));
    };

    const onNodeDoubleClick = (event, node) => { setModalInfo({ mode: 'edit', goal: node.data }); };

    return (
        <div className="card">
            <Link to="/" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>&larr; Projelerime Dön</Link>
            <button onClick={() => { localStorage.removeItem('api_token'); window.location.reload(); }} style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>Çıkış Yap</button>
            <hr />
            <div className="org-chart">
                {nodes.length > 0 ? (
                    <ReactFlow
                        nodes={nodes} edges={edges} onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange} nodeTypes={nodeTypes}
                        onNodeDoubleClick={onNodeDoubleClick}
                    >
                        <Controls />
                        <Background />
                    </ReactFlow>
                ) : (<h2>Proje Yükleniyor...</h2>)}
            </div>
            {modalInfo && <GoalFormModal modalInfo={modalInfo} onSave={handleSaveGoal} onCancel={() => setModalInfo(null)} />}
        </div>
    );
}

// === UYGULAMA SARICI ===
export default function MindMap() {
    return (
        <ReactFlowProvider>
            <MindMapInternal />
        </ReactFlowProvider>
    )
}