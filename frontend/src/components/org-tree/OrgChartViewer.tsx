
import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  Controls,
  Background,
  type Node,
  MiniMap,
  ReactFlowProvider,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
 import { Box, Button, CircularProgress, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { Save, Add, Edit, Delete, AddCircle } from '@mui/icons-material';
import OrgTreeNode, { ORG_TREE_NODE_HEIGHT, ORG_TREE_NODE_WIDTH } from './OrgTreeNode';
import NodeEditDialog from './NodeEditDialog';
import { orgTreeService } from '../../services';
import { useAuthStore } from '../../store/authStore';
import type { OrgTreeNode as OrgTreeNodeType } from '../../types';
import { shellPanelHeaderSx, shellPanelSx } from '../../styles/shell';

// Register custom node types
const nodeTypes = {
  orgNode: OrgTreeNode,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];
const orgChartContainerRadius = '12px';
const orgChartOverlayRadius = '10px';

// Simple hierarchical layout function
const layoutNodes = (nodes: Node[], edges: Edge[]): Node[] => {
  if (nodes.length === 0) return nodes;
  
  // Check if any nodes have saved positions (not 0,0)
  const hasPositions = nodes.some(n => n.position.x !== 0 || n.position.y !== 0);
  if (hasPositions) return nodes; // Use saved positions
  
  // Build parent-child relationships
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();
  
  edges.forEach(edge => {
    const children = childrenMap.get(edge.source) || [];
    children.push(edge.target);
    childrenMap.set(edge.source, children);
    parentMap.set(edge.target, edge.source);
  });
  
  // Find root nodes (no parent)
  const roots = nodes.filter(n => !parentMap.has(n.id));
  
  // Calculate positions hierarchically
  const nodeWidth = ORG_TREE_NODE_WIDTH;
  const nodeHeight = ORG_TREE_NODE_HEIGHT;
  const horizontalGap = 50;
  const verticalGap = 80;
  
  const positionedNodes = new Map<string, { x: number; y: number }>();
  
  const calculateSubtreeWidth = (nodeId: string): number => {
    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) return nodeWidth;
    return children.reduce((sum, childId) => sum + calculateSubtreeWidth(childId) + horizontalGap, -horizontalGap);
  };
  
  const positionNode = (nodeId: string, x: number, y: number): void => {
    positionedNodes.set(nodeId, { x, y });
    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) return;
    
    const totalWidth = children.reduce((sum, childId) => sum + calculateSubtreeWidth(childId) + horizontalGap, -horizontalGap);
    let currentX = x - totalWidth / 2 + nodeWidth / 2;
    
    children.forEach(childId => {
      const childWidth = calculateSubtreeWidth(childId);
      positionNode(childId, currentX + childWidth / 2 - nodeWidth / 2, y + nodeHeight + verticalGap);
      currentX += childWidth + horizontalGap;
    });
  };
  
  // Position all root nodes
  let startX = 0;
   roots.forEach((root) => {
    const subtreeWidth = calculateSubtreeWidth(root.id);
    positionNode(root.id, startX + subtreeWidth / 2, 0);
    startX += subtreeWidth + horizontalGap * 2;
  });
  
  return nodes.map(n => ({
    ...n,
    position: positionedNodes.get(n.id) || n.position
  }));
};

const OrgChartViewer: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, baseOnEdgesChange] = useEdgesState(initialEdges);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  
  // Node edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<OrgTreeNodeType | null>(null);
  const [newNodeParentId, setNewNodeParentId] = useState<string | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    nodeId: string;
  } | null>(null);
  
  // Store original data for node info
  const [treeData, setTreeData] = useState<OrgTreeNodeType[]>([]);

  const { user } = useAuthStore();
  const isAdmin = user?.isAdmin ?? false;

  const onEdgesChange = useCallback<typeof baseOnEdgesChange>((changes) => {
    baseOnEdgesChange(changes);
    if (changes.length > 0) {
      setIsDirty(true);
    }
  }, [baseOnEdgesChange]);

  // Fetch tree data
  const loadTreeData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await orgTreeService.getTree();
      setTreeData(data);
      
      // Transform data to ReactFlow nodes and edges
      const rfNodes: Node[] = data.map((item) => ({
        id: item.id,
        type: 'orgNode',
        position: item.style?.position || { x: 0, y: 0 }, // Default or saved pos
        data: { ...item, isAdmin }, // Pass full item data and isAdmin to node
        draggable: isAdmin,
      }));

      const rfEdges: Edge[] = data
        .filter((item) => item.parentId)
        .map((item) => ({
          id: `e-${item.parentId}-${item.id}`,
          source: item.parentId!,
          target: item.id,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#b1b1b7', strokeWidth: 2 },
        }));

      // Apply auto-layout if nodes don't have saved positions
      const layoutedNodes = layoutNodes(rfNodes, rfEdges);
      
      setNodes(layoutedNodes);
      setEdges(rfEdges);
    } catch (error) {
      console.error('Failed to load org tree:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, setNodes, setEdges]);

   useEffect(() => {
     loadTreeData();
   }, [loadTreeData]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((edgesState) => {
        const withoutExistingParent = edgesState.filter((edge) => edge.target !== params.target);
        return addEdge(params, withoutExistingParent);
      });
      setIsDirty(true);
    },
    [setEdges]
  );

   const onNodeDragStop = useCallback(
     (_event: React.MouseEvent, _node: Node) => { // eslint-disable-line @typescript-eslint/no-unused-vars
         // Mark as dirty to save positions
         setIsDirty(true);
         // We could also auto-save here
     }, 
     []
   );

  const handleSave = async () => {
      // Save all node positions
      try {
          // Optimize: only save changed nodes? Or batch all.
          // For simplicity, let's just save the moved ones or all.
          // Since API updateNode takes one by one, we need to be careful.
          // Better approach: bulk update endpoint (not implemented yet).
          // For now, let's just log or implement a loop.
          
          const parentByNodeId = new Map<string, string | null>();
          nodes.forEach((node) => {
            parentByNodeId.set(node.id, null);
          });
          edges.forEach((edge) => {
            parentByNodeId.set(edge.target, edge.source);
          });

          const updates = nodes.map((node) =>
             orgTreeService.updateNode(node.id, {
                 parentId: parentByNodeId.get(node.id) ?? null,
                 style: { position: node.position }
             })
          );
          
          await Promise.all(updates);
          setIsDirty(false);
          alert('Сохранено!');
      } catch (error) {
          console.error('Save failed', error);
          alert('Ошибка сохранения');
      }
  };

  const handleAddNode = () => {
    // Open modal to create root node
    setEditingNode(null);
    setNewNodeParentId(null);
    setDialogOpen(true);
  };
  
  // Handle right-click on node
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!isAdmin) return;
      event.preventDefault();
      setContextMenu({
        mouseX: event.clientX,
        mouseY: event.clientY,
        nodeId: node.id,
      });
    },
    [isAdmin]
  );
  
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };
  
  const handleEditNode = () => {
    if (!contextMenu) return;
    const nodeData = treeData.find(n => n.id === contextMenu.nodeId);
    if (nodeData) {
      setEditingNode(nodeData);
      setNewNodeParentId(null);
      setDialogOpen(true);
    }
    handleCloseContextMenu();
  };
  
  const handleAddChildNode = () => {
    if (!contextMenu) return;
    setEditingNode(null);
    setNewNodeParentId(contextMenu.nodeId);
    setDialogOpen(true);
    handleCloseContextMenu();
  };
  
  const handleDeleteNode = async () => {
    if (!contextMenu) return;
    const confirmed = window.confirm('Удалить этот узел? Дочерние узлы станут корневыми.');
    if (confirmed) {
      try {
        await orgTreeService.deleteNode(contextMenu.nodeId);
        loadTreeData();
      } catch (error) {
        console.error('Failed to delete node:', error);
        alert('Ошибка удаления узла');
      }
    }
    handleCloseContextMenu();
  };
  
  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingNode(null);
    setNewNodeParentId(null);
  };
  
  const handleDialogSave = () => {
    loadTreeData();
    setIsDirty(false);
  };
  
  // Get node list for parent selection in dialog
  const allNodesList = treeData.map(n => ({
    id: n.id,
    label: n.customTitle || n.linkedUser?.position || n.department?.name || 'Узел',
  }));

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      ...shellPanelSx,
      borderRadius: orgChartContainerRadius,
      height: '100%', 
      width: '100%', 
      overflow: 'hidden',
      position: 'relative',
       '& .react-flow__viewport': {
         '&::-webkit-scrollbar': { display: 'none' },
         scrollbarWidth: 'none',
         msOverflowStyle: 'none',
       },
       '& .react-flow__container': {
         '&::-webkit-scrollbar': { display: 'none' },
         scrollbarWidth: 'none',
         msOverflowStyle: 'none',
       },
       '& .react-flow__background path': {
         stroke: 'rgba(35, 91, 116, 0.08)',
       },
       '& .react-flow__controls': {
         borderRadius: orgChartOverlayRadius,
         overflow: 'hidden',
         border: '1px solid rgba(255,255,255,0.52)',
         boxShadow: '0 14px 32px rgba(26, 58, 76, 0.12)',
       },
       '& .react-flow__controls button': {
         background: 'rgba(255,255,255,0.82)',
         color: 'rgba(22, 48, 66, 0.84)',
         borderBottomColor: 'rgba(35, 91, 116, 0.08)',
       },
       '& .react-flow__minimap': {
         borderRadius: orgChartOverlayRadius,
         overflow: 'hidden',
         border: '1px solid rgba(255,255,255,0.52)',
         background: 'rgba(255,255,255,0.72)',
         boxShadow: '0 14px 30px rgba(26, 58, 76, 0.12)',
       },
    }}>
      <Box sx={{ ...shellPanelHeaderSx, px: 2.4, py: 1.5 }}>
        <Box sx={{ fontWeight: 700, color: 'text.primary' }}>Структура организации</Box>
      </Box>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={isAdmin ? onConnect : undefined}
        onNodeDragStop={isAdmin ? onNodeDragStop : undefined}
        onNodeContextMenu={isAdmin ? handleNodeContextMenu : undefined}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[50, 50]}
        nodesDraggable={isAdmin}
        nodesConnectable={isAdmin}
        style={{ background: 'transparent' }}
      >
        <Controls />
        <MiniMap />
        <Background gap={50} size={1} />
        
        {isAdmin && (
            <Panel position="top-right">
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        startIcon={<Save />}
                        disabled={!isDirty}
                        onClick={handleSave}
                    >
                        Сохранить
                    </Button>
                    <Button 
                        variant="contained" 
                        color="secondary" 
                        startIcon={<Add />}
                        onClick={handleAddNode}
                    >
                        Добавить
                    </Button>
                </Box>
            </Panel>
        )}
      </ReactFlow>
      
      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleEditNode}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Редактировать</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleAddChildNode}>
          <ListItemIcon>
            <AddCircle fontSize="small" />
          </ListItemIcon>
          <ListItemText>Добавить дочерний</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteNode}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Удалить</ListItemText>
        </MenuItem>
      </Menu>
      
      {/* Node Edit Dialog */}
      <NodeEditDialog
        open={dialogOpen}
        node={editingNode}
        parentId={newNodeParentId}
        allNodes={allNodesList}
        onClose={handleDialogClose}
        onSave={handleDialogSave}
        onDelete={handleDialogSave}
      />
    </Box>
  );
};

export default function OrgChartWrapper() {
    return (
        <ReactFlowProvider>
            <OrgChartViewer />
        </ReactFlowProvider>
    );
}
