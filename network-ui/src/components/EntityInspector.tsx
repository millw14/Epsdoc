/**
 * EntityInspector Component
 * 
 * Advanced inspection panel for selected entities.
 * Shows detailed information, relationship timeline, and AI-powered explanations.
 * Designed with a technical, investigative aesthetic.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  User,
  Network,
  Clock,
  FileText,
  ChevronRight,
  MapPin,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { Relationship } from '../types';
import type { SpatialNode } from '../lib/spatial-adapter';
import { fetchDocument } from '../api';
import DocumentModal from './DocumentModal';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface EntityInspectorProps {
  entity: SpatialNode | null;
  relationships: Relationship[];
  totalRelationships: number;
  onClose: () => void;
  onRequestAIExplanation?: (entityName: string, relationships: Relationship[]) => void;
  aiExplanation?: string | null;
  aiLoading?: boolean;
}

interface RelationshipGroup {
  target: string;
  count: number;
  relationships: Relationship[];
  earliestDate: string | null;
  latestDate: string | null;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function groupRelationshipsByTarget(
  relationships: Relationship[],
  entityName: string
): RelationshipGroup[] {
  const groups = new Map<string, RelationshipGroup>();
  
  relationships.forEach(rel => {
    const otherEntity = rel.actor === entityName ? rel.target : rel.actor;
    
    if (!groups.has(otherEntity)) {
      groups.set(otherEntity, {
        target: otherEntity,
        count: 0,
        relationships: [],
        earliestDate: null,
        latestDate: null,
      });
    }
    
    const group = groups.get(otherEntity)!;
    group.count++;
    group.relationships.push(rel);
    
    if (rel.timestamp) {
      if (!group.earliestDate || rel.timestamp < group.earliestDate) {
        group.earliestDate = rel.timestamp;
      }
      if (!group.latestDate || rel.timestamp > group.latestDate) {
        group.latestDate = rel.timestamp;
      }
    }
  });
  
  // Sort by count descending
  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

function formatDateRange(earliest: string | null, latest: string | null): string {
  if (!earliest && !latest) return 'Undated';
  if (earliest === latest) return earliest || 'Undated';
  return `${earliest || '?'} to ${latest || '?'}`;
}

// -----------------------------------------------------------------------------
// Relationship Item Component
// -----------------------------------------------------------------------------

interface RelationshipItemProps {
  relationship: Relationship;
  entityName: string;
  onViewDocument: (docId: string) => void;
}

function RelationshipItem({ relationship, entityName, onViewDocument }: RelationshipItemProps) {
  const isActor = relationship.actor === entityName;
  
  return (
    <button
      onClick={() => onViewDocument(relationship.doc_id)}
      className="w-full text-left p-2 hover:bg-gray-700/30 rounded transition-colors group"
    >
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {relationship.timestamp || 'Undated'}
        </span>
        {relationship.location && (
          <span className="text-xs text-gray-600 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {relationship.location}
          </span>
        )}
      </div>
      
      <div className="text-sm">
        <span className={isActor ? 'text-cyan-400' : 'text-gray-300'}>
          {relationship.actor}
        </span>
        <span className="text-gray-500 mx-1.5">{relationship.action}</span>
        <span className={!isActor ? 'text-cyan-400' : 'text-gray-300'}>
          {relationship.target}
        </span>
      </div>
      
      <div className="text-xs text-gray-600 mt-1 flex items-center gap-1 group-hover:text-gray-400">
        <FileText className="w-3 h-3" />
        {relationship.doc_id}
        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

// -----------------------------------------------------------------------------
// Connection Group Component
// -----------------------------------------------------------------------------

interface ConnectionGroupProps {
  group: RelationshipGroup;
  entityName: string;
  onViewDocument: (docId: string) => void;
}

function ConnectionGroup({ group, entityName, onViewDocument }: ConnectionGroupProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="border-b border-gray-800 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-200">{group.target}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {formatDateRange(group.earliestDate, group.latestDate)}
          </span>
          <span className="text-xs font-mono bg-gray-800 px-2 py-0.5 rounded text-blue-400">
            {group.count}
          </span>
          <ChevronRight
            className={`w-4 h-4 text-gray-500 transition-transform ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        </div>
      </button>
      
      {expanded && (
        <div className="pb-2 px-2">
          {group.relationships.map((rel, idx) => (
            <RelationshipItem
              key={`${rel.id}-${idx}`}
              relationship={rel}
              entityName={entityName}
              onViewDocument={onViewDocument}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function EntityInspector({
  entity,
  relationships,
  totalRelationships,
  onClose,
  onRequestAIExplanation,
  aiExplanation,
  aiLoading,
}: EntityInspectorProps) {
  const [documentToView, setDocumentToView] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'connections' | 'timeline'>('connections');
  
  // Group relationships by connected entity
  const connectionGroups = useMemo(() => {
    if (!entity) return [];
    return groupRelationshipsByTarget(relationships, entity.name);
  }, [relationships, entity]);
  
  // Sort relationships by timestamp for timeline view
  const timelineSorted = useMemo(() => {
    return [...relationships].sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return a.timestamp.localeCompare(b.timestamp);
    });
  }, [relationships]);
  
  // Unique connection count
  const uniqueConnections = connectionGroups.length;
  
  // Request AI explanation when entity changes
  useEffect(() => {
    if (entity && onRequestAIExplanation && relationships.length > 0) {
      onRequestAIExplanation(entity.name, relationships);
    }
  }, [entity?.name]);

  if (!entity) return null;

  return (
    <>
      <div className="w-96 bg-gray-950/95 border-l border-cyan-900/30 flex flex-col h-full overflow-hidden backdrop-blur-sm">
        {/* Header */}
        <div className="p-4 border-b border-cyan-900/30 flex-shrink-0 bg-gradient-to-r from-cyan-950/30 to-transparent">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-cyan-500/20 rounded border border-cyan-500/30 flex items-center justify-center">
                  <User className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full animate-pulse"></div>
              </div>
              <div>
                <div className="text-[10px] text-cyan-600 font-mono tracking-widest">TARGET PROFILE</div>
                <h2 className="font-mono font-bold text-cyan-400">{entity.name}</h2>
                <p className="text-[10px] text-gray-500 font-mono">
                  {entity.hopDistance === 0
                    ? 'PRINCIPAL SUBJECT'
                    : entity.hopDistance === 1
                      ? 'DIRECT CONNECTION'
                      : `${entity.hopDistance} DEGREES SEPARATION`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors"
              title="Close inspector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Stats Row */}
          <div className="flex gap-4 mt-3 pt-3 border-t border-cyan-900/20">
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <Network className="w-3.5 h-3.5 text-cyan-500" />
              <span className="text-gray-500">LINKS:</span>
              <span className="text-cyan-400">{uniqueConnections}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <FileText className="w-3.5 h-3.5 text-cyan-500" />
              <span className="text-gray-500">REFS:</span>
              <span className="text-cyan-400">
                {relationships.length}
                {totalRelationships > relationships.length && (
                  <span className="text-gray-600">/{totalRelationships}</span>
                )}
              </span>
            </div>
          </div>
        </div>
        
        {/* AI Explanation Section */}
        {onRequestAIExplanation && (
          <div className="p-4 border-b border-cyan-900/30 flex-shrink-0 bg-purple-950/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-mono text-purple-400 tracking-wider">AI ANALYSIS</h3>
            </div>
            
            {aiLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                PROCESSING...
              </div>
            ) : aiExplanation ? (
              <p className="text-xs text-gray-400 leading-relaxed font-mono">
                {aiExplanation}
              </p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-600 font-mono">
                <AlertCircle className="w-4 h-4" />
                NO DATA AVAILABLE
              </div>
            )}
          </div>
        )}
        
        {/* Tab Navigation */}
        <div className="flex border-b border-cyan-900/30 flex-shrink-0">
          <button
            onClick={() => setActiveTab('connections')}
            className={`flex-1 px-4 py-2 text-xs font-mono transition-colors ${
              activeTab === 'connections'
                ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-500/5'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            CONNECTIONS
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 px-4 py-2 text-xs font-mono transition-colors ${
              activeTab === 'timeline'
                ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-500/5'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            TIMELINE
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'connections' ? (
            <div className="divide-y divide-cyan-900/20">
              {connectionGroups.length === 0 ? (
                <div className="p-4 text-center text-gray-600 text-xs font-mono">
                  NO CONNECTIONS FOUND
                </div>
              ) : (
                connectionGroups.map(group => (
                  <ConnectionGroup
                    key={group.target}
                    group={group}
                    entityName={entity.name}
                    onViewDocument={setDocumentToView}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="p-2">
              {timelineSorted.length === 0 ? (
                <div className="p-4 text-center text-gray-600 text-xs font-mono">
                  NO EVENTS FOUND
                </div>
              ) : (
                timelineSorted.map((rel, idx) => (
                  <RelationshipItem
                    key={`${rel.id}-${idx}`}
                    relationship={rel}
                    entityName={entity.name}
                    onViewDocument={setDocumentToView}
                  />
                ))
              )}
            </div>
          )}
        </div>
        
        {/* Footer hint */}
        <div className="p-3 border-t border-cyan-900/30 text-[10px] text-gray-600 text-center font-mono tracking-wider">
          SELECT EVENT TO VIEW SOURCE DOCUMENT
        </div>
      </div>
      
      {/* Document Modal */}
      {documentToView && (() => {
        const rel = relationships.find(r => r.doc_id === documentToView);
        return rel ? (
          <DocumentModal
            docId={documentToView}
            highlightTerm={entity.name}
            secondaryHighlightTerm={
              rel.actor === entity.name ? rel.target : rel.actor
            }
            onClose={() => setDocumentToView(null)}
          />
        ) : null;
      })()}
    </>
  );
}
