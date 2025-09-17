import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Collapse,
  Box,
  Typography,
  useTheme,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useResponsive } from '@/hooks/useResponsive';

export interface ResponsiveTableColumn {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => React.ReactNode;
  sortable?: boolean;
  hiddenOnMobile?: boolean;
  priority?: 'high' | 'medium' | 'low'; // 移动端显示优先级
}

export interface ResponsiveTableRow {
  id: string;
  [key: string]: any;
}

interface ResponsiveTableProps {
  columns: ResponsiveTableColumn[];
  rows: ResponsiveTableRow[];
  onRowClick?: (row: ResponsiveTableRow) => void;
  stickyHeader?: boolean;
  maxHeight?: number;
  mobileCardView?: boolean;
  expandableRows?: boolean;
  renderExpandedContent?: (row: ResponsiveTableRow) => React.ReactNode;
}

const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  columns,
  rows,
  onRowClick,
  stickyHeader = false,
  maxHeight,
  mobileCardView = true,
  expandableRows = false,
  renderExpandedContent,
}) => {
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const handleExpandRow = (rowId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  // 移动端卡片视图
  const renderMobileCardView = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rows.map((row) => {
        const isExpanded = expandedRows.has(row.id);
        const primaryColumns = columns.filter(col => col.priority === 'high' || !col.priority);
        const secondaryColumns = columns.filter(col => col.priority === 'medium' || col.priority === 'low');

        return (
          <Card
            key={row.id}
            sx={{
              cursor: onRowClick ? 'pointer' : 'default',
              '&:hover': onRowClick ? {
                backgroundColor: theme.palette.action.hover,
              } : {},
            }}
            onClick={() => onRowClick?.(row)}
          >
            <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
              {/* 主要信息 */}
              {primaryColumns.map((column) => (
                <Box key={column.id} sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {column.label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {column.format ? column.format(row[column.id]) : row[column.id]}
                  </Typography>
                </Box>
              ))}

              {/* 展开/收起按钮 */}
              {(expandableRows || secondaryColumns.length > 0) && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {isExpanded ? '收起详情' : '展开详情'}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExpandRow(row.id);
                      }}
                    >
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                </>
              )}

              {/* 展开的内容 */}
              <Collapse in={isExpanded}>
                <Box sx={{ mt: 2 }}>
                  {/* 次要信息 */}
                  {secondaryColumns.map((column) => (
                    <Box key={column.id} sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {column.label}
                      </Typography>
                      <Typography variant="body2">
                        {column.format ? column.format(row[column.id]) : row[column.id]}
                      </Typography>
                    </Box>
                  ))}

                  {/* 自定义展开内容 */}
                  {renderExpandedContent && (
                    <Box sx={{ mt: 2 }}>
                      {renderExpandedContent(row)}
                    </Box>
                  )}
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );

  // 平板/桌面表格视图
  const renderTableView = () => {
    const visibleColumns = columns.filter(col =>
      isMobile ? !col.hiddenOnMobile : true
    );

    return (
      <TableContainer
        component={Paper}
        sx={{
          maxHeight,
          '& .MuiTableCell-root': {
            fontSize: isMobile ? '0.8rem' : '0.875rem',
            padding: isMobile ? theme.spacing(0.5, 1) : theme.spacing(1, 2),
          },
        }}
      >
        <Table stickyHeader={stickyHeader} size={isMobile ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  style={{ minWidth: column.minWidth }}
                  sx={{
                    fontWeight: 600,
                    backgroundColor: theme.palette.background.default,
                  }}
                >
                  {column.label}
                </TableCell>
              ))}
              {expandableRows && (
                <TableCell align="center" sx={{ width: 48 }}>
                  操作
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const isExpanded = expandedRows.has(row.id);

              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    hover={!!onRowClick}
                    onClick={() => onRowClick?.(row)}
                    sx={{
                      cursor: onRowClick ? 'pointer' : 'default',
                    }}
                  >
                    {visibleColumns.map((column) => (
                      <TableCell key={column.id} align={column.align}>
                        {column.format ? column.format(row[column.id]) : row[column.id]}
                      </TableCell>
                    ))}
                    {expandableRows && (
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExpandRow(row.id);
                          }}
                        >
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                  {expandableRows && (
                    <TableRow>
                      <TableCell
                        style={{ paddingBottom: 0, paddingTop: 0 }}
                        colSpan={visibleColumns.length + 1}
                      >
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>
                            {renderExpandedContent?.(row)}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // 根据设备类型选择渲染方式
  if (isMobile && mobileCardView) {
    return renderMobileCardView();
  } else {
    return renderTableView();
  }
};

export default ResponsiveTable;